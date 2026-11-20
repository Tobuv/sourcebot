import { describe, expect, test, vi } from 'vitest';
import type { CustomLanguageModel } from '@sourcebot/db';

vi.mock('server-only', () => ({ default: vi.fn() }));
vi.mock('@/prisma', () => ({ __unsafePrisma: {} }));
// Reversible stand-in for the real AES encryption.
vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
    encrypt: (text: string) => ({ iv: 'aa', encryptedData: Buffer.from(text).toString('hex') }),
    decrypt: (iv: string, data: string) => {
        if (iv !== 'aa') {
            throw new Error('bad iv');
        }
        return Buffer.from(data, 'hex').toString();
    },
}));

const { decryptApiKey, encryptApiKey, isResolvedSecretToken, toCustomModelInfo, toLanguageModelConfig, canEditCustomModel } = await import('./customModels.server');
const { customModelInputSchema, maskApiKey } = await import('./customModelUtils');

const record = (overrides: Partial<CustomLanguageModel> = {}): CustomLanguageModel => ({
    id: 'm1',
    scope: 'WORKSPACE',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    displayName: 'Claude',
    baseUrl: null,
    imageInput: false,
    temperature: null,
    settings: {},
    encryptedApiKey: encryptApiKey('sk-secret-1234'),
    orgId: 1,
    createdById: 'u1',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
});

describe('api key encryption', () => {
    test('round-trips', () => {
        expect(decryptApiKey(encryptApiKey('abc'))).toBe('abc');
    });

    test('returns undefined for malformed or undecryptable values', () => {
        expect(decryptApiKey('garbage')).toBeUndefined();
        expect(decryptApiKey('bb:00')).toBeUndefined();
    });
});

describe('toLanguageModelConfig', () => {
    test('uses an in-memory secret token for the API key', () => {
        const config = toLanguageModelConfig(record());
        expect(config).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-4-5', displayName: 'Claude', imageInput: false });
        const token = (config as { token?: unknown }).token;
        expect(isResolvedSecretToken(token)).toBe(true);
        expect(token).toEqual({ secret: 'sk-secret-1234' });
    });

    test('sends the key as a bearer token for anthropic when configured', () => {
        const config = toLanguageModelConfig(record({ settings: { authType: 'bearer' } })) as Record<string, unknown>;
        expect(config.token).toBeUndefined();
        expect(config.authToken).toEqual({ secret: 'sk-secret-1234' });
    });

    test('omits the token when there is no key so the provider env var is used', () => {
        const config = toLanguageModelConfig(record({ encryptedApiKey: null })) as Record<string, unknown>;
        expect(config.token).toBeUndefined();
        expect(config.authToken).toBeUndefined();
    });

    test('maps provider specific settings', () => {
        expect(toLanguageModelConfig(record({ provider: 'azure', settings: { resourceName: 'res', apiVersion: '2025-01-01' } })))
            .toMatchObject({ provider: 'azure', resourceName: 'res', apiVersion: '2025-01-01' });
        expect(toLanguageModelConfig(record({ provider: 'openai-compatible', baseUrl: 'https://x/v1', settings: { reasoningTag: 'think' } })))
            .toMatchObject({ provider: 'openai-compatible', baseUrl: 'https://x/v1', reasoningTag: 'think' });
    });

    test('includes optional base URL and temperature', () => {
        expect(toLanguageModelConfig(record({ baseUrl: 'https://gw/v1', temperature: 0.2, imageInput: true })))
            .toMatchObject({ baseUrl: 'https://gw/v1', temperature: 0.2, imageInput: true });
    });

    test('ignores unknown providers', () => {
        expect(toLanguageModelConfig(record({ provider: 'amazon-bedrock' }))).toBeUndefined();
    });
});

describe('toCustomModelInfo', () => {
    test('never exposes the key, only a hint', () => {
        const info = toCustomModelInfo(record(), 'u1', 'OWNER');
        expect(JSON.stringify(info)).not.toContain('sk-secret');
        expect(info).toMatchObject({ hasApiKey: true, apiKeyHint: '1234', canEdit: true });
    });
});

describe('canEditCustomModel', () => {
    test('workspace models are editable by owners only', () => {
        expect(canEditCustomModel({ scope: 'WORKSPACE', createdById: 'u1' }, 'u1', 'OWNER')).toBe(true);
        expect(canEditCustomModel({ scope: 'WORKSPACE', createdById: 'u1' }, 'u1', 'MEMBER')).toBe(false);
    });

    test('personal models are editable by their creator only', () => {
        expect(canEditCustomModel({ scope: 'PERSONAL', createdById: 'u1' }, 'u1', 'MEMBER')).toBe(true);
        expect(canEditCustomModel({ scope: 'PERSONAL', createdById: 'u1' }, 'u2', 'OWNER')).toBe(false);
        expect(canEditCustomModel({ scope: 'PERSONAL', createdById: 'u1' }, undefined, 'OWNER')).toBe(false);
    });
});

describe('customModelInputSchema', () => {
    const valid = { scope: 'PERSONAL', provider: 'openai', model: 'gpt-5', displayName: 'GPT', imageInput: false } as const;

    test('accepts a minimal model and trims fields', () => {
        const parsed = customModelInputSchema.parse({ ...valid, displayName: '  GPT  ', baseUrl: '  ' });
        expect(parsed.displayName).toBe('GPT');
        expect(parsed.baseUrl).toBeUndefined();
        expect(parsed.settings).toEqual({});
    });

    test('requires a base URL for openai-compatible', () => {
        expect(customModelInputSchema.safeParse({ ...valid, provider: 'openai-compatible' }).success).toBe(false);
        expect(customModelInputSchema.safeParse({ ...valid, provider: 'openai-compatible', baseUrl: 'https://x/v1' }).success).toBe(true);
    });

    test('requires a resource name or base URL for azure', () => {
        expect(customModelInputSchema.safeParse({ ...valid, provider: 'azure' }).success).toBe(false);
        expect(customModelInputSchema.safeParse({ ...valid, provider: 'azure', settings: { resourceName: 'r' } }).success).toBe(true);
    });

    test('rejects invalid values', () => {
        expect(customModelInputSchema.safeParse({ ...valid, provider: 'amazon-bedrock' }).success).toBe(false);
        expect(customModelInputSchema.safeParse({ ...valid, baseUrl: 'ftp://x' }).success).toBe(false);
        expect(customModelInputSchema.safeParse({ ...valid, temperature: 3 }).success).toBe(false);
        expect(customModelInputSchema.safeParse({ ...valid, displayName: ' ' }).success).toBe(false);
    });
});

test('maskApiKey', () => {
    expect(maskApiKey('sk-abcdefgh')).toBe('efgh');
    expect(maskApiKey('short')).toBeUndefined();
});
