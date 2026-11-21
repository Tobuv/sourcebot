import * as Sentry from '@sentry/node';
import { PrismaClient, Repo, ScipIndexStatus } from "@sourcebot/db";
import { createLogger, env, getRepoPath } from "@sourcebot/shared";
import { Job, Queue, Worker } from "bullmq";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { mkdir, readFile, rm } from "fs/promises";
import { Redis } from "ioredis";
import path from "path";
import { WORKER_STOP_GRACEFUL_TIMEOUT_MS } from "../constants.js";
import { detectIndexers, IndexerInvocation, IndexerNotInstalledError, runIndexer } from "./indexers.js";
import { decodeScipIndex, OccurrenceRow, parseDocument, parseExternalSymbols, SymbolRow } from "./parse.js";

const LOG_TAG = 'scip-index-manager';
const logger = createLogger(LOG_TAG);
const QUEUE_NAME = 'scip-index-queue';

const INSERT_BATCH_SIZE = 5000;
const MAX_ERROR_LENGTH = 4000;
const BACKFILL_INTERVAL_MS = 1000 * 60 * 5;
/** Failed indexes are retried once this much time has passed (e.g. after installing an indexer). */
const FAILED_RETRY_AFTER_MS = 1000 * 60 * 60;

type JobPayload = {
    repoId: number;
    repoName: string;
    commitHash: string;
};

/**
 * Generates precise code intelligence indexes (SCIP) for repositories and stores
 * them in the database, where the web app uses them for precise code navigation.
 *
 * An index is generated for the default branch HEAD whenever a repository finishes
 * (re-)indexing at a new commit. Once a new index completes, older indexes for the
 * same repository and indexer are removed.
 */
export class ScipIndexManager {
    private queue: Queue<JobPayload>;
    private worker: Worker<JobPayload>;
    private interval?: NodeJS.Timeout;
    private abortController = new AbortController();

    constructor(
        private db: PrismaClient,
        redis: Redis,
        private dataCacheDir: string = env.DATA_CACHE_DIR,
    ) {
        this.queue = new Queue<JobPayload>(QUEUE_NAME, {
            connection: redis,
            defaultJobOptions: {
                removeOnComplete: true,
                removeOnFail: env.REDIS_REMOVE_ON_FAIL,
                attempts: 1,
            },
        });

        this.worker = new Worker<JobPayload>(
            QUEUE_NAME,
            this.runJob.bind(this),
            {
                connection: redis,
                concurrency: env.PRECISE_CODE_NAV_JOB_CONCURRENCY,
                // Indexing can take a long time; don't treat long jobs as stalled.
                lockDuration: 1000 * 60 * 5,
                maxStalledCount: 1,
            }
        );

        this.worker.on('failed', (job, error) => {
            logger.error(`SCIP index job for ${job?.data.repoName} failed: ${error.message}`);
        });
        this.worker.on('error', (error) => {
            logger.error(`SCIP index worker error:`, error);
        });
    }

    public static isEnabled() {
        return env.PRECISE_CODE_NAV_ENABLED === 'true';
    }

    public async startScheduler() {
        // Generate indexes for repos that were indexed before this feature existed
        // (or whose SCIP job was lost, e.g. on restart).
        await this.backfill().catch((error) => logger.error('SCIP backfill failed:', error));
        this.interval = setInterval(() => {
            this.backfill().catch((error) => logger.error('SCIP backfill failed:', error));
        }, BACKFILL_INTERVAL_MS);
    }

    /**
     * Schedules SCIP indexing of `repo` at `commitHash`. No-op when an index job for the
     * same commit is already queued, or an index for that commit already exists (failed
     * indexes are retried after `FAILED_RETRY_AFTER_MS`).
     */
    public async enqueue(repo: Pick<Repo, 'id' | 'name'>, commitHash: string) {
        const existing = await this.db.scipIndex.findMany({
            where: {
                repoId: repo.id,
                commitHash,
            },
            select: { status: true, updatedAt: true },
        });
        const retryCutoff = Date.now() - FAILED_RETRY_AFTER_MS;
        const isRunning = existing.some((index) => index.status === ScipIndexStatus.PENDING || index.status === ScipIndexStatus.IN_PROGRESS);
        const hasRetryableFailure = existing.some((index) => index.status === ScipIndexStatus.FAILED && index.updatedAt.getTime() <= retryCutoff);
        const shouldSkip = existing.length > 0 && (isRunning || !hasRetryableFailure);
        if (shouldSkip) {
            return;
        }

        await this.queue.add('index', {
            repoId: repo.id,
            repoName: repo.name,
            commitHash,
        }, {
            // Deduplicate jobs for the same commit.
            jobId: `${repo.id}-${commitHash}`,
        });
        logger.debug(`Queued SCIP index job for ${repo.name} @ ${commitHash.slice(0, 12)}`);
    }

    private async backfill() {
        const repos = await this.db.repo.findMany({
            where: {
                indexedCommitHash: { not: null },
            },
            select: {
                id: true,
                name: true,
                indexedCommitHash: true,
                scipIndexes: {
                    select: { commitHash: true, status: true, updatedAt: true },
                },
            },
        });

        for (const repo of repos) {
            const commitHash = repo.indexedCommitHash!;
            const retryCutoff = Date.now() - FAILED_RETRY_AFTER_MS;
            const indexes = repo.scipIndexes.filter((index) => index.commitHash === commitHash);
            const hasRetryableFailure = indexes.some((index) => index.status === ScipIndexStatus.FAILED && index.updatedAt.getTime() <= retryCutoff);
            if (indexes.length > 0 && !hasRetryableFailure) {
                continue;
            }
            await this.enqueue(repo, commitHash);
        }
    }

    private async runJob(job: Job<JobPayload>) {
        const { repoId, commitHash } = job.data;
        const signal = this.abortController.signal;

        const repo = await this.db.repo.findUnique({ where: { id: repoId } });
        if (!repo) {
            logger.debug(`Repo ${repoId} no longer exists, skipping SCIP indexing.`);
            return;
        }

        const workDir = path.join(this.dataCacheDir, 'scip-tmp', randomUUID());
        const projectDir = path.join(workDir, 'src');
        const outputDir = path.join(workDir, 'out');

        try {
            await mkdir(projectDir, { recursive: true });
            await mkdir(outputDir, { recursive: true });

            const { path: repoPath } = getRepoPath(repo);
            await exportCommit({ repoPath, commitHash, destination: projectDir, signal });

            const invocations = await detectIndexers({
                projectDir,
                outputDir,
                projectName: repo.name,
                commitHash,
            });

            if (invocations.length === 0) {
                logger.debug(`No supported languages detected for ${repo.name}, skipping SCIP indexing.`);
                return;
            }

            // On retries, only re-run indexers that haven't completed for this commit.
            const completed = new Set((await this.db.scipIndex.findMany({
                where: { repoId, commitHash, status: ScipIndexStatus.COMPLETED },
                select: { indexer: true },
            })).map((index) => index.indexer));

            for (const invocation of invocations) {
                if (signal.aborted) {
                    return;
                }
                if (completed.has(invocation.indexer)) {
                    continue;
                }
                await this.runIndexer({ repo, commitHash, invocation, projectDir, signal });
            }
        } finally {
            await rm(workDir, { recursive: true, force: true }).catch(() => {});
        }
    }

    private async runIndexer({
        repo,
        commitHash,
        invocation,
        projectDir,
        signal,
    }: {
        repo: Repo;
        commitHash: string;
        invocation: IndexerInvocation;
        projectDir: string;
        signal: AbortSignal;
    }) {
        const index = await this.db.scipIndex.create({
            data: {
                repoId: repo.id,
                indexer: invocation.indexer,
                commitHash,
                status: ScipIndexStatus.IN_PROGRESS,
            },
        });

        const startedAt = Date.now();
        logger.info(`Running ${invocation.indexer} for ${repo.name} @ ${commitHash.slice(0, 12)}...`);

        try {
            await runIndexer(invocation, {
                cwd: projectDir,
                signal,
                timeoutMs: env.PRECISE_CODE_NAV_INDEXER_TIMEOUT_SECONDS * 1000,
            });

            const outputFile = invocation.args[invocation.args.indexOf('--output') + 1];
            const counts = await this.ingest({
                indexId: index.id,
                file: outputFile,
                invocation,
                projectDir,
            });

            await this.db.scipIndex.update({
                where: { id: index.id },
                data: {
                    status: ScipIndexStatus.COMPLETED,
                    completedAt: new Date(),
                    documentCount: counts.documentCount,
                    occurrenceCount: counts.occurrenceCount,
                },
            });

            // The new index supersedes all previous indexes from this indexer.
            await this.db.scipIndex.deleteMany({
                where: {
                    repoId: repo.id,
                    indexer: invocation.indexer,
                    id: { not: index.id },
                },
            });

            logger.info(`${invocation.indexer} finished for ${repo.name} in ${Math.round((Date.now() - startedAt) / 1000)}s (${counts.documentCount} documents, ${counts.occurrenceCount} occurrences).`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (error instanceof IndexerNotInstalledError) {
                logger.warn(message);
            } else {
                logger.error(`${invocation.indexer} failed for ${repo.name}: ${message}`);
                Sentry.captureException(error);
            }

            // Remove any partially ingested rows, but keep the index row to surface the error.
            await this.db.scipOccurrence.deleteMany({ where: { indexId: index.id } });
            await this.db.scipSymbol.deleteMany({ where: { indexId: index.id } });
            // Only keep the latest failure for this indexer at this commit.
            await this.db.scipIndex.deleteMany({
                where: {
                    repoId: repo.id,
                    indexer: invocation.indexer,
                    commitHash,
                    status: ScipIndexStatus.FAILED,
                    id: { not: index.id },
                },
            }).catch(() => {});
            await this.db.scipIndex.update({
                where: { id: index.id },
                data: {
                    status: ScipIndexStatus.FAILED,
                    error: message.slice(-MAX_ERROR_LENGTH),
                    completedAt: new Date(),
                },
            }).catch(() => {});
        }
    }

    private async ingest({
        indexId,
        file,
        invocation,
        projectDir,
    }: {
        indexId: string;
        file: string;
        invocation: IndexerInvocation;
        projectDir: string;
    }) {
        const index = decodeScipIndex(await readFile(file));

        const totalOccurrences = index.documents.reduce((sum, document) => sum + document.occurrences.length, 0);
        if (totalOccurrences > env.PRECISE_CODE_NAV_MAX_OCCURRENCES) {
            throw new Error(`Index has ${totalOccurrences} occurrences, which exceeds PRECISE_CODE_NAV_MAX_OCCURRENCES (${env.PRECISE_CODE_NAV_MAX_OCCURRENCES}).`);
        }

        const readSource = (relativePath: string) => {
            const fullPath = path.join(projectDir, relativePath);
            // Guard against paths escaping the project directory.
            if (!fullPath.startsWith(projectDir + path.sep) || !existsSync(fullPath)) {
                return undefined;
            }
            try {
                return readFileSync(fullPath, 'utf-8');
            } catch {
                return undefined;
            }
        }

        let occurrenceBuffer: OccurrenceRow[] = [];
        let symbolBuffer: SymbolRow[] = [];
        let occurrenceCount = 0;

        const flushOccurrences = async () => {
            if (occurrenceBuffer.length === 0) {
                return;
            }
            await this.db.scipOccurrence.createMany({
                data: occurrenceBuffer.map((row) => ({ ...row, indexId })),
            });
            occurrenceCount += occurrenceBuffer.length;
            occurrenceBuffer = [];
        }

        const seenSymbols = new Set<string>();
        const flushSymbols = async () => {
            if (symbolBuffer.length === 0) {
                return;
            }
            await this.db.scipSymbol.createMany({
                data: symbolBuffer.map((row) => ({ ...row, indexId })),
            });
            symbolBuffer = [];
        }
        const addSymbols = async (rows: SymbolRow[]) => {
            for (const row of rows) {
                if (seenSymbols.has(row.symbol)) {
                    continue;
                }
                seenSymbols.add(row.symbol);
                symbolBuffer.push(row);
                if (symbolBuffer.length >= INSERT_BATCH_SIZE) {
                    await flushSymbols();
                }
            }
        }

        for (const document of index.documents) {
            const parsed = parseDocument(document, {
                defaultPositionEncoding: invocation.defaultPositionEncoding,
                readSource,
            });

            for (const occurrence of parsed.occurrences) {
                occurrenceBuffer.push(occurrence);
                if (occurrenceBuffer.length >= INSERT_BATCH_SIZE) {
                    await flushOccurrences();
                }
            }
            await addSymbols(parsed.symbols);
        }
        await addSymbols(parseExternalSymbols(index));

        await flushOccurrences();
        await flushSymbols();

        return {
            documentCount: index.documents.length,
            occurrenceCount,
        };
    }

    public async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.abortController.abort();
        await this.worker.close(/* force = */ false);
        await Promise.race([
            this.queue.close(),
            new Promise((resolve) => setTimeout(resolve, WORKER_STOP_GRACEFUL_TIMEOUT_MS)),
        ]);
    }
}

/**
 * Writes the tree of `commitHash` into `destination` (without a .git directory).
 * Works with the bare clones Sourcebot keeps on disk.
 */
const exportCommit = ({
    repoPath,
    commitHash,
    destination,
    signal,
}: {
    repoPath: string;
    commitHash: string;
    destination: string;
    signal: AbortSignal;
}) => {
    return new Promise<void>((resolve, reject) => {
        if (!/^[0-9a-f]{7,64}$/i.test(commitHash)) {
            reject(new Error(`Invalid commit hash: ${commitHash}`));
            return;
        }

        const archive = spawn('git', ['-C', repoPath, 'archive', '--format=tar', commitHash], { signal });
        const tar = spawn('tar', ['-x', '-C', destination], { signal });
        archive.stdout.pipe(tar.stdin);

        let stderr = '';
        archive.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        tar.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

        const exited = (child: ReturnType<typeof spawn>) => new Promise<number | null>((resolveExit, rejectExit) => {
            child.on('error', rejectExit);
            child.on('close', resolveExit);
        });

        Promise.all([exited(archive), exited(tar)])
            .then(([archiveCode, tarCode]) => {
                if (archiveCode !== 0 || tarCode !== 0) {
                    reject(new Error(`Failed to export ${commitHash}: ${stderr.slice(-2000)}`));
                    return;
                }
                resolve();
            })
            .catch(reject);
    });
}
