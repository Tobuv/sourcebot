import 'server-only';

import { isGitRefValid, isPathValid } from "@/features/git/utils";
import { detectLanguageFromFilename } from "@/lib/languageDetection";
import { invalidGitRef, notFound, ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withOptionalAuth } from "@/middleware/withAuth";
import { Org, Prisma, PrismaClient, Repo } from "@sourcebot/db";
import { createLogger, env, getRepoPath } from "@sourcebot/shared";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";
import { FindRelatedSymbolsResponse } from "@/features/codeNav/types";
import simpleGit from "simple-git";
import { escapeLikePattern, getVersionlessSymbolParts, isLocalSymbol } from "./symbols";
import {
    PreciseCodeNavStatusRequest,
    PreciseCodeNavStatusResponse,
    PreciseFileMatches,
    PreciseHoverResponse,
    PreciseRelatedSymbolsRequest,
    PreciseRelatedSymbolsResponse,
    SymbolPosition,
} from "./types";

const logger = createLogger('precise-code-nav');

/** Maximum number of occurrences returned for a definitions / references request. */
const MAX_RESULTS = 1000;
/** Maximum number of files whose contents are read to render line previews. */
const MAX_PREVIEW_FILES = 200;
const MAX_LINE_LENGTH = 1000;

const SYMBOL_ROLE_DEFINITION = 1;

type OccurrenceResult = {
    repoId: number;
    commitHash: string;
    filePath: string;
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
    roles: number;
};

type ResolvedRevision = {
    repo: Repo;
    commitHash: string;
    indexIds: string[];
};

/**
 * Resolves `revisionName` of `repoName` to a commit and returns the completed SCIP
 * indexes generated for exactly that commit. Indexes for other commits are ignored,
 * as their positions may not line up with the file being viewed.
 */
const resolveRevision = async ({
    prisma,
    org,
    repoName,
    revisionName,
}: {
    prisma: PrismaClient;
    org: Org;
    repoName: string;
    revisionName?: string;
}): Promise<ResolvedRevision | ServiceError> => {
    const repo = await prisma.repo.findFirst({
        where: { name: repoName, orgId: org.id },
    });
    if (!repo) {
        return notFound(`Repository "${repoName}" not found.`);
    }

    const ref = revisionName ?? repo.defaultBranch ?? 'HEAD';
    if (!isGitRefValid(ref)) {
        return invalidGitRef(ref);
    }

    let commitHash: string;
    if (/^[0-9a-f]{40}$/i.test(ref)) {
        commitHash = ref.toLowerCase();
    } else {
        try {
            const { path: repoPath } = getRepoPath(repo);
            commitHash = (await simpleGit().cwd(repoPath).raw(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])).trim();
        } catch {
            return { repo, commitHash: '', indexIds: [] };
        }
    }

    const indexes = await prisma.scipIndex.findMany({
        where: {
            repoId: repo.id,
            commitHash,
            status: 'COMPLETED',
        },
        select: { id: true },
    });

    return {
        repo,
        commitHash,
        indexIds: indexes.map((index) => index.id),
    };
}

const getVisibleRepoIds = async (prisma: PrismaClient, org: Org) => {
    const repos = await prisma.repo.findMany({
        where: { orgId: org.id },
        select: { id: true },
    });
    return repos.map((repo) => repo.id);
}

const findOccurrenceAt = async (
    prisma: PrismaClient,
    indexIds: string[],
    { path, line, character }: Pick<SymbolPosition, 'path' | 'line' | 'character'>,
) => {
    const candidates = await prisma.scipOccurrence.findMany({
        where: {
            indexId: { in: indexIds },
            filePath: path,
            startLine: { lte: line },
            endLine: { gte: line },
        },
        select: {
            symbol: true,
            roles: true,
            startLine: true,
            startChar: true,
            endLine: true,
            endChar: true,
            indexId: true,
        },
    });

    const containing = candidates.filter((occurrence) => {
        const afterStart = line > occurrence.startLine || character >= occurrence.startChar;
        const beforeEnd = line < occurrence.endLine || character <= occurrence.endChar;
        return afterStart && beforeEnd;
    });

    // Prefer the narrowest range (e.g. a method name over an enclosing expression),
    // and definitions over references at the same range.
    containing.sort((a, b) => {
        const sizeA = (a.endLine - a.startLine) * 100_000 + (a.endChar - a.startChar);
        const sizeB = (b.endLine - b.startLine) * 100_000 + (b.endChar - b.startChar);
        if (sizeA !== sizeB) {
            return sizeA - sizeB;
        }
        return (b.roles & SYMBOL_ROLE_DEFINITION) - (a.roles & SYMBOL_ROLE_DEFINITION);
    });

    return containing[0];
}

const queryOccurrences = async ({
    prisma,
    symbol,
    repoIds,
    definitionsOnly,
    local,
}: {
    prisma: PrismaClient;
    symbol: string;
    repoIds: number[];
    definitionsOnly: boolean;
    /** Local symbols are only meaningful within a single document of a single index. */
    local?: { indexId: string; filePath: string };
}): Promise<OccurrenceResult[]> => {
    if (repoIds.length === 0) {
        return [];
    }

    const roleFilter = definitionsOnly
        ? Prisma.sql`AND (o."roles" & ${SYMBOL_ROLE_DEFINITION}) = ${SYMBOL_ROLE_DEFINITION}`
        : Prisma.empty;

    const scopeFilter = local
        ? Prisma.sql`AND o."indexId" = ${local.indexId} AND o."filePath" = ${local.filePath}`
        : Prisma.empty;

    const exact = await prisma.$queryRaw<OccurrenceResult[]>`
        SELECT i."repoId", i."commitHash", o."filePath", o."startLine", o."startChar", o."endLine", o."endChar", o."roles"
        FROM "ScipOccurrence" o
        JOIN "ScipIndex" i ON i."id" = o."indexId"
        WHERE o."symbol" = ${symbol}
          AND i."status" = 'COMPLETED'
          AND i."repoId" IN (${Prisma.join(repoIds)})
          ${roleFilter}
          ${scopeFilter}
        ORDER BY i."repoId", o."filePath", o."startLine", o."startChar"
        LIMIT ${MAX_RESULTS + 1}
    `;

    if (exact.length > 0 || local || !definitionsOnly) {
        return exact;
    }

    // The definition may live in another indexed repository that was indexed at a
    // different version than the one referenced here. Retry ignoring the version.
    const parts = getVersionlessSymbolParts(symbol);
    if (!parts) {
        return exact;
    }

    return prisma.$queryRaw<OccurrenceResult[]>`
        SELECT i."repoId", i."commitHash", o."filePath", o."startLine", o."startChar", o."endLine", o."endChar", o."roles"
        FROM "ScipOccurrence" o
        JOIN "ScipIndex" i ON i."id" = o."indexId"
        WHERE o."symbol" LIKE ${escapeLikePattern(parts.prefix) + '%'}
          AND o."symbol" LIKE ${'%' + escapeLikePattern(parts.suffix)}
          AND i."status" = 'COMPLETED'
          AND i."repoId" IN (${Prisma.join(repoIds)})
          ${roleFilter}
        ORDER BY i."repoId", o."filePath", o."startLine", o."startChar"
        LIMIT ${MAX_RESULTS + 1}
    `;
}

/**
 * Groups occurrences by file and attaches the line contents.
 */
const buildResponse = async ({
    prisma,
    symbol,
    occurrences,
    sourceRepo,
    sourceRevisionName,
}: {
    prisma: PrismaClient;
    symbol?: string;
    occurrences: OccurrenceResult[];
    sourceRepo?: Repo;
    sourceRevisionName?: string;
}): Promise<PreciseRelatedSymbolsResponse> => {
    const truncated = occurrences.length > MAX_RESULTS;
    const limited = occurrences.slice(0, MAX_RESULTS);

    const repoIds = [...new Set(limited.map((occurrence) => occurrence.repoId))];
    const repos = await prisma.repo.findMany({
        where: { id: { in: repoIds } },
    });
    const reposById = new Map(repos.map((repo) => [repo.id, repo]));

    const groups = new Map<string, { repo: Repo, commitHash: string, filePath: string, occurrences: OccurrenceResult[] }>();
    for (const occurrence of limited) {
        const repo = reposById.get(occurrence.repoId);
        if (!repo) {
            // Not visible to the user (should already be filtered out).
            continue;
        }
        const key = `${occurrence.repoId}\0${occurrence.commitHash}\0${occurrence.filePath}`;
        const group = groups.get(key) ?? { repo, commitHash: occurrence.commitHash, filePath: occurrence.filePath, occurrences: [] };
        group.occurrences.push(occurrence);
        groups.set(key, group);
    }

    const groupList = [...groups.values()];
    const fileLines = await readFilesLines(groupList.slice(0, MAX_PREVIEW_FILES));

    const files: PreciseFileMatches[] = groupList.map((group, index) => {
        const lines = fileLines[index];
        const revisionName = group.repo.id === sourceRepo?.id && sourceRevisionName
            ? sourceRevisionName
            : group.commitHash;

        return {
            repoId: group.repo.id,
            repoName: group.repo.name,
            repoDisplayName: group.repo.displayName ?? undefined,
            revisionName,
            path: group.filePath,
            language: detectLanguageFromFilename(group.filePath),
            matches: group.occurrences.map((occurrence) => {
                const lineContent = lines?.[occurrence.startLine] ?? '';
                return {
                    line: occurrence.startLine,
                    startChar: occurrence.startChar,
                    endLine: occurrence.endLine,
                    endChar: occurrence.endChar,
                    lineContent: lineContent.length > MAX_LINE_LENGTH ? lineContent.slice(0, MAX_LINE_LENGTH) : lineContent,
                    isDefinition: (occurrence.roles & SYMBOL_ROLE_DEFINITION) !== 0,
                };
            }),
        };
    });

    // Show the file the request came from first.
    files.sort((a, b) => {
        const aIsSource = a.repoId === sourceRepo?.id ? 0 : 1;
        const bIsSource = b.repoId === sourceRepo?.id ? 0 : 1;
        return aIsSource - bIsSource;
    });

    return {
        symbol,
        matchCount: limited.length,
        truncated,
        files,
    };
}

const readFilesLines = async (groups: { repo: Repo, commitHash: string, filePath: string }[]): Promise<(string[] | undefined)[]> => {
    const results: (string[] | undefined)[] = new Array(groups.length);
    const CONCURRENCY = 8;
    let next = 0;

    const worker = async () => {
        while (next < groups.length) {
            const current = next++;
            const { repo, commitHash, filePath } = groups[current];
            if (!isPathValid(filePath)) {
                continue;
            }
            try {
                const { path: repoPath } = getRepoPath(repo);
                const content = await simpleGit().cwd(repoPath).raw(['show', `${commitHash}:${filePath}`]);
                results[current] = content.split('\n');
            } catch (error) {
                logger.debug(`Failed to read ${repo.name}@${commitHash}:${filePath}`, error);
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return results;
}

export const getPreciseCodeNavStatus = async ({ repoName, revisionName }: PreciseCodeNavStatusRequest): Promise<PreciseCodeNavStatusResponse | ServiceError> => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        const resolved = await resolveRevision({ prisma, org, repoName, revisionName });
        if (isServiceError(resolved)) {
            return resolved;
        }

        const indexes = await prisma.scipIndex.findMany({
            where: { repoId: resolved.repo.id },
            orderBy: { createdAt: 'desc' },
        });

        return {
            available: resolved.indexIds.length > 0,
            commitHash: resolved.commitHash || undefined,
            indexes: indexes.map((index) => ({
                indexer: index.indexer,
                commitHash: index.commitHash,
                status: index.status,
                error: index.error ?? undefined,
                completedAt: index.completedAt?.toISOString(),
            })),
        };
    }));

export const getPreciseHover = async (position: SymbolPosition): Promise<PreciseHoverResponse | ServiceError> => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        const resolved = await resolveRevision({ prisma, org, repoName: position.repoName, revisionName: position.revisionName });
        if (isServiceError(resolved)) {
            return resolved;
        }
        if (resolved.indexIds.length === 0) {
            return null;
        }

        const occurrence = await findOccurrenceAt(prisma, resolved.indexIds, position);
        if (!occurrence) {
            return null;
        }

        const isLocal = isLocalSymbol(occurrence.symbol);
        // Prefer documentation from this repo's index, fall back to any index
        // (e.g. the definition lives in another indexed repo).
        const info = isLocal ? undefined : (
            await prisma.scipSymbol.findFirst({
                where: { symbol: occurrence.symbol, indexId: { in: resolved.indexIds } },
            }) ?? await prisma.scipSymbol.findFirst({
                where: {
                    symbol: occurrence.symbol,
                    index: {
                        status: 'COMPLETED',
                        repoId: { in: await getVisibleRepoIds(prisma, org) },
                    },
                },
            })
        );

        return {
            symbol: occurrence.symbol,
            isLocal,
            range: {
                startLine: occurrence.startLine,
                startChar: occurrence.startChar,
                endLine: occurrence.endLine,
                endChar: occurrence.endChar,
            },
            displayName: info?.displayName ?? info?.name ?? undefined,
            kind: info?.kind ?? undefined,
            signature: info?.signature ?? undefined,
            documentation: info?.documentation ?? undefined,
        };
    }));

/**
 * Finds the definitions or references of the symbol at the given position.
 * Returns `null` when no precise index is available for the position, in which
 * case callers should fall back to search based navigation.
 */
export const findPreciseRelatedSymbols = async (request: PreciseRelatedSymbolsRequest): Promise<PreciseRelatedSymbolsResponse | null | ServiceError> => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        const resolved = await resolveRevision({ prisma, org, repoName: request.repoName, revisionName: request.revisionName });
        if (isServiceError(resolved)) {
            return resolved;
        }
        if (resolved.indexIds.length === 0) {
            return null;
        }

        const occurrence = await findOccurrenceAt(prisma, resolved.indexIds, request);
        if (!occurrence) {
            return null;
        }

        const isLocal = isLocalSymbol(occurrence.symbol);
        const occurrences = await queryOccurrences({
            prisma,
            symbol: occurrence.symbol,
            repoIds: isLocal ? [resolved.repo.id] : await getVisibleRepoIds(prisma, org),
            definitionsOnly: request.kind === 'definitions',
            local: isLocal ? { indexId: occurrence.indexId, filePath: request.path } : undefined,
        });

        return buildResponse({
            prisma,
            symbol: occurrence.symbol,
            occurrences,
            sourceRepo: resolved.repo,
            sourceRevisionName: request.revisionName,
        });
    }));

/**
 * Name based lookup used when no position is known (e.g. the Ask agent tools or the
 * public API). Finds all symbols named `symbolName` defined in the repo's precise
 * index and returns their definitions or references. Unlike search based navigation,
 * this never matches comments, strings or unrelated identifiers that merely share a
 * prefix.
 *
 * Returns `null` when the repo has no precise index (callers should fall back).
 */
export const findPreciseRelatedSymbolsByName = async ({
    prisma,
    org,
    repoName,
    revisionName,
    symbolName,
    kind,
}: {
    prisma: PrismaClient;
    org: Org;
    repoName: string;
    revisionName?: string;
    symbolName: string;
    kind: 'definitions' | 'references';
}): Promise<PreciseRelatedSymbolsResponse | null | ServiceError> => {
    const resolved = await resolveRevision({
        prisma,
        org,
        repoName,
        // The search based API uses "HEAD" to mean the default branch.
        revisionName: revisionName === 'HEAD' ? undefined : revisionName,
    });
    if (isServiceError(resolved)) {
        return resolved;
    }
    if (resolved.indexIds.length === 0) {
        return null;
    }

    const symbols = await prisma.scipSymbol.findMany({
        where: {
            indexId: { in: resolved.indexIds },
            name: symbolName,
        },
        select: { symbol: true },
        take: 50,
    });

    const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.symbol))];
    if (uniqueSymbols.length === 0) {
        return { matchCount: 0, truncated: false, files: [] };
    }

    const roleFilter = kind === 'definitions'
        ? Prisma.sql`AND (o."roles" & ${SYMBOL_ROLE_DEFINITION}) = ${SYMBOL_ROLE_DEFINITION}`
        : Prisma.empty;

    const occurrences = await prisma.$queryRaw<OccurrenceResult[]>`
        SELECT i."repoId", i."commitHash", o."filePath", o."startLine", o."startChar", o."endLine", o."endChar", o."roles"
        FROM "ScipOccurrence" o
        JOIN "ScipIndex" i ON i."id" = o."indexId"
        WHERE o."symbol" IN (${Prisma.join(uniqueSymbols)})
          AND o."indexId" IN (${Prisma.join(resolved.indexIds)})
          ${roleFilter}
        ORDER BY o."filePath", o."startLine", o."startChar"
        LIMIT ${MAX_RESULTS + 1}
    `;

    return buildResponse({
        prisma,
        occurrences,
        sourceRepo: resolved.repo,
        sourceRevisionName: revisionName,
    });
}

/**
 * Converts a precise response into the format returned by the search based
 * `/api/find_definitions` and `/api/find_references` endpoints.
 */
export const toFindRelatedSymbolsResponse = async (prisma: PrismaClient, response: PreciseRelatedSymbolsResponse): Promise<FindRelatedSymbolsResponse> => {
    const repos = await prisma.repo.findMany({
        where: { id: { in: [...new Set(response.files.map((file) => file.repoId))] } },
    });

    const toLocation = (lineContent: string, line: number, character: number) => ({
        // Byte offset within the line (the file offset isn't tracked by the index).
        byteOffset: Buffer.byteLength(lineContent.slice(0, character), 'utf-8'),
        lineNumber: line + 1,
        column: [...lineContent.slice(0, character)].length + 1,
    });

    return {
        stats: {
            matchCount: response.matchCount,
        },
        files: response.files.map((file) => ({
            fileName: file.path,
            repository: file.repoName,
            repositoryId: file.repoId,
            webUrl: `${env.AUTH_URL}${getBrowsePath({
                repoName: file.repoName,
                path: file.path,
                pathType: 'blob',
                revisionName: file.revisionName,
            })}`,
            language: file.language,
            matches: file.matches.map((match) => ({
                lineContent: match.lineContent,
                range: {
                    start: toLocation(match.lineContent, match.line, match.startChar),
                    end: toLocation(match.lineContent, match.line, match.endLine === match.line ? match.endChar : match.lineContent.length),
                },
            })),
        })),
        repositoryInfo: repos.map((repo) => ({
            id: repo.id,
            codeHostType: repo.external_codeHostType,
            name: repo.name,
            displayName: repo.displayName ?? undefined,
            webUrl: repo.webUrl ?? undefined,
        })),
    };
}
