import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getMavenMirrorEnv } from './indexers';

vi.mock('@sourcebot/shared', () => ({
    env: {},
}));

describe('getMavenMirrorEnv', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'scip-mirror-'));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test('points sbt, Maven and coursier at the mirror', async () => {
        const mirror = 'https://maven.aliyun.com/repository/public';
        const env = await getMavenMirrorEnv(mirror, dir);

        expect(env.COURSIER_REPOSITORIES).toBe(`ivy2Local|${mirror}`);

        const sbtRepositories = path.join(dir, 'sbt-repositories');
        expect(env.SBT_OPTS).toContain(`-Dsbt.repository.config=${sbtRepositories}`);
        expect(env.SBT_OPTS).toContain('-Dsbt.override.build.repos=true');
        expect(await readFile(sbtRepositories, 'utf-8')).toBe(`[repositories]\n  local\n  mirror: ${mirror}\n`);

        const mavenSettings = path.join(dir, 'maven-settings.xml');
        expect(env.MAVEN_ARGS).toBe(`--settings ${mavenSettings}`);
        const settings = await readFile(mavenSettings, 'utf-8');
        expect(settings).toContain('<mirrorOf>central</mirrorOf>');
        expect(settings).toContain(`<url>${mirror}</url>`);
    });

    test('keeps existing SBT_OPTS', async () => {
        const previous = process.env.SBT_OPTS;
        process.env.SBT_OPTS = '-Dsbt.global.base=/cache/sbt';
        try {
            const env = await getMavenMirrorEnv('https://example.com/maven', dir);
            expect(env.SBT_OPTS?.startsWith('-Dsbt.global.base=/cache/sbt ')).toBe(true);
        } finally {
            if (previous === undefined) {
                delete process.env.SBT_OPTS;
            } else {
                process.env.SBT_OPTS = previous;
            }
        }
    });
});
