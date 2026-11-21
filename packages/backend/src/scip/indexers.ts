import { PositionEncoding } from "@scip-code/scip";
import { env } from "@sourcebot/shared";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";

export type ScipLanguage = 'typescript' | 'go' | 'python' | 'java';

export type IndexerInvocation = {
    language: ScipLanguage;
    /** Name stored on the ScipIndex row. */
    indexer: string;
    command: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
    /** Position encoding to assume when documents don't declare one. */
    defaultPositionEncoding: PositionEncoding;
};

const hasAny = (dir: string, files: string[]) => files.some((file) => existsSync(path.join(dir, file)));

const readJson = (file: string): Record<string, unknown> | undefined => {
    try {
        return JSON.parse(readFileSync(file, 'utf-8'));
    } catch {
        return undefined;
    }
}

export const getEnabledLanguages = (): Set<ScipLanguage> => {
    const supported: ScipLanguage[] = ['typescript', 'go', 'python', 'java'];
    const requested = env.PRECISE_CODE_NAV_LANGUAGES
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value): value is ScipLanguage => (supported as string[]).includes(value));
    return new Set(requested);
}

/**
 * Detects which SCIP indexers apply to the project checked out at `projectDir` and
 * returns how to invoke them. `outputDir` is where each indexer writes its index.
 */
export const detectIndexers = async ({
    projectDir,
    outputDir,
    projectName,
    commitHash,
    enabledLanguages = getEnabledLanguages(),
}: {
    projectDir: string;
    outputDir: string;
    projectName: string;
    commitHash: string;
    enabledLanguages?: Set<ScipLanguage>;
}): Promise<IndexerInvocation[]> => {
    const invocations: IndexerInvocation[] = [];

    if (enabledLanguages.has('typescript') && hasAny(projectDir, ['tsconfig.json', 'jsconfig.json', 'package.json'])) {
        const args = ['index', '--output', path.join(outputDir, 'typescript.scip')];
        const packageJson = readJson(path.join(projectDir, 'package.json'));

        if (existsSync(path.join(projectDir, 'pnpm-workspace.yaml'))) {
            args.push('--pnpm-workspaces');
        } else if (packageJson && 'workspaces' in packageJson) {
            args.push('--yarn-workspaces');
        } else if (!hasAny(projectDir, ['tsconfig.json'])) {
            // Without a tsconfig.json, let scip-typescript infer one (covers plain JS projects).
            args.push('--infer-tsconfig');
        }

        invocations.push({
            language: 'typescript',
            indexer: 'scip-typescript',
            command: env.SCIP_TYPESCRIPT_PATH,
            args,
            env: {
                // Large projects can exceed the default heap size.
                NODE_OPTIONS: '--max-old-space-size=8192',
            },
            defaultPositionEncoding: PositionEncoding.UTF16CodeUnitOffsetFromLineStart,
        });
    }

    if (enabledLanguages.has('go') && hasAny(projectDir, ['go.mod'])) {
        invocations.push({
            language: 'go',
            indexer: 'scip-go',
            command: env.SCIP_GO_PATH,
            args: [
                'index',
                '--output', path.join(outputDir, 'go.scip'),
                // The project is exported without a .git directory, so the version
                // can't be inferred.
                '--module-version', commitHash.slice(0, 12),
            ],
            env: {
                // Never prompt for credentials when downloading modules.
                GIT_TERMINAL_PROMPT: '0',
            },
            // go/token columns are byte offsets.
            defaultPositionEncoding: PositionEncoding.UTF8CodeUnitOffsetFromLineStart,
        });
    }

    if (enabledLanguages.has('python') && hasAny(projectDir, ['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt', 'Pipfile'])) {
        // scip-python normally shells out to `pip` to discover installed packages.
        // Passing an explicit (empty) environment avoids depending on the worker's
        // Python environment and keeps the run hermetic.
        const environmentFile = path.join(outputDir, 'python-environment.json');
        await writeFile(environmentFile, '[]');

        invocations.push({
            language: 'python',
            indexer: 'scip-python',
            command: env.SCIP_PYTHON_PATH,
            args: [
                'index', '.',
                '--project-name', projectName,
                // The project is exported without a .git directory, so the version
                // can't be inferred (scip-python crashes without one).
                '--project-version', commitHash.slice(0, 12),
                '--environment', environmentFile,
                '--output', path.join(outputDir, 'python.scip'),
            ],
            env: {
                NODE_OPTIONS: '--max-old-space-size=8192',
            },
            defaultPositionEncoding: PositionEncoding.UTF16CodeUnitOffsetFromLineStart,
        });
    }

    if (
        enabledLanguages.has('java') &&
        env.PRECISE_CODE_NAV_ALLOW_BUILD_EXECUTION === 'true' &&
        hasAny(projectDir, ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts', 'build.sbt'])
    ) {
        invocations.push({
            language: 'java',
            indexer: 'scip-java',
            command: env.SCIP_JAVA_PATH,
            args: ['index', '--output', path.join(outputDir, 'java.scip')],
            // scip-java resolves `java` (and the build tool) from PATH. Honor JAVA_HOME
            // so a JDK doesn't need to be installed globally.
            env: process.env.JAVA_HOME ? {
                PATH: `${path.join(process.env.JAVA_HOME, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
            } : undefined,
            defaultPositionEncoding: PositionEncoding.UTF16CodeUnitOffsetFromLineStart,
        });
    }

    return invocations;
}

export class IndexerNotInstalledError extends Error {
    constructor(command: string) {
        super(`SCIP indexer "${command}" is not installed or not on PATH.`);
        this.name = 'IndexerNotInstalledError';
    }
}

const MAX_CAPTURED_OUTPUT = 16 * 1024;

/**
 * Runs an indexer to completion. Rejects with the tail of its output on failure.
 */
export const runIndexer = (
    invocation: IndexerInvocation,
    { cwd, signal, timeoutMs }: { cwd: string; signal?: AbortSignal; timeoutMs: number },
): Promise<void> => {
    return new Promise((resolve, reject) => {
        let output = '';
        const append = (chunk: Buffer) => {
            output = (output + chunk.toString()).slice(-MAX_CAPTURED_OUTPUT);
        }

        const child = spawn(invocation.command, invocation.args, {
            cwd,
            env: {
                ...process.env,
                ...invocation.env,
            },
            // Run in its own process group so the whole tree can be killed on timeout.
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const kill = () => {
            if (child.pid !== undefined) {
                try {
                    process.kill(-child.pid, 'SIGKILL');
                } catch {
                    child.kill('SIGKILL');
                }
            }
        }

        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            kill();
        }, timeoutMs);

        const onAbort = () => kill();
        signal?.addEventListener('abort', onAbort);

        child.stdout.on('data', append);
        child.stderr.on('data', append);

        child.on('error', (error: NodeJS.ErrnoException) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            if (error.code === 'ENOENT') {
                reject(new IndexerNotInstalledError(invocation.command));
                return;
            }
            reject(error);
        });

        child.on('close', (code) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            if (timedOut) {
                reject(new Error(`${invocation.indexer} timed out after ${Math.round(timeoutMs / 1000)}s.\n${output}`));
                return;
            }
            if (signal?.aborted) {
                reject(new Error(`${invocation.indexer} was aborted.`));
                return;
            }
            if (code !== 0) {
                reject(new Error(`${invocation.indexer} exited with code ${code}.\n${output}`));
                return;
            }
            resolve();
        });
    });
}
