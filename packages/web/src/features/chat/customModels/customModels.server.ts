import 'server-only';

import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { __unsafePrisma } from "@/prisma";
import { CustomLanguageModel, OrgRole, PrismaClient } from "@sourcebot/db";
import type { LanguageModel } from "@sourcebot/schemas/v3/languageModel.type";
import type { Token } from "@sourcebot/schemas/v3/shared.type";
import { createLogger, decrypt, encrypt } from "@sourcebot/shared";
import {
    CUSTOM_MODEL_PROVIDERS,
    CustomModelInfo,
    CustomModelProvider,
    customModelSettingsSchema,
    maskApiKey,
} from "./customModelUtils";

const logger = createLogger('custom-language-models');

type CustomLanguageModelWithCreator = CustomLanguageModel & { createdBy?: { name: string | null; email: string | null } | null };

/**
 * A token holding an already-resolved secret (e.g. a decrypted API key from the
 * database). Only ever created on the server, in memory; resolved by
 * `resolveConfigToken` in utils.server.ts.
 */
export type ResolvedSecretToken = { secret: string };

export const isResolvedSecretToken = (token: unknown): token is ResolvedSecretToken =>
    typeof token === 'object' && token !== null && 'secret' in token && typeof (token as ResolvedSecretToken).secret === 'string';

const secretToken = (secret: string) => ({ secret }) as unknown as Token;

export const encryptApiKey = (apiKey: string) => {
    const { iv, encryptedData } = encrypt(apiKey);
    return `${iv}:${encryptedData}`;
}

export const decryptApiKey = (value: string): string | undefined => {
    const [iv, data] = value.split(':');
    if (!iv || !data) {
        return undefined;
    }
    try {
        return decrypt(iv, data);
    } catch (error) {
        // e.g. SOURCEBOT_ENCRYPTION_KEY changed since the key was saved.
        logger.error('Failed to decrypt API key of a custom language model', error);
        return undefined;
    }
}

const getSettings = (record: CustomLanguageModel) => {
    const parsed = customModelSettingsSchema.safeParse(record.settings ?? {});
    return parsed.success ? parsed.data : {};
}

/**
 * Converts a custom model into the same `LanguageModel` shape used for models
 * defined in the config file, so it works with all existing code paths.
 * Returns undefined for records with an unknown provider.
 */
export const toLanguageModelConfig = (record: CustomLanguageModel): LanguageModel | undefined => {
    if (!(CUSTOM_MODEL_PROVIDERS as readonly string[]).includes(record.provider)) {
        return undefined;
    }

    const provider = record.provider as CustomModelProvider;
    const settings = getSettings(record);
    const apiKey = record.encryptedApiKey ? decryptApiKey(record.encryptedApiKey) : undefined;

    const base = {
        model: record.model,
        displayName: record.displayName,
        imageInput: record.imageInput,
        ...(record.baseUrl ? { baseUrl: record.baseUrl } : {}),
        ...(record.temperature !== null ? { temperature: record.temperature } : {}),
    };

    switch (provider) {
        case 'anthropic':
            return {
                provider,
                ...base,
                ...(apiKey ? (settings.authType === 'bearer' ? { authToken: secretToken(apiKey) } : { token: secretToken(apiKey) }) : {}),
            };
        case 'azure':
            return {
                provider,
                ...base,
                ...(apiKey ? { token: secretToken(apiKey) } : {}),
                ...(settings.resourceName ? { resourceName: settings.resourceName } : {}),
                ...(settings.apiVersion ? { apiVersion: settings.apiVersion } : {}),
            };
        case 'openai-compatible':
            return {
                provider,
                ...base,
                baseUrl: record.baseUrl ?? '',
                ...(apiKey ? { token: secretToken(apiKey) } : {}),
                ...(settings.reasoningTag ? { reasoningTag: settings.reasoningTag } : {}),
            };
        default:
            return {
                provider,
                ...base,
                ...(apiKey ? { token: secretToken(apiKey) } : {}),
            } as LanguageModel;
    }
}

export const canEditCustomModel = (
    record: Pick<CustomLanguageModel, 'scope' | 'createdById'>,
    userId: string | undefined,
    role: OrgRole,
) => {
    if (!userId) {
        return false;
    }
    if (record.scope === 'WORKSPACE') {
        return role === OrgRole.OWNER;
    }
    return record.createdById === userId;
}

export const toCustomModelInfo = (record: CustomLanguageModelWithCreator, userId: string | undefined, role: OrgRole): CustomModelInfo => {
    const apiKey = record.encryptedApiKey ? decryptApiKey(record.encryptedApiKey) : undefined;
    return {
        id: record.id,
        scope: record.scope,
        provider: record.provider as CustomModelProvider,
        model: record.model,
        displayName: record.displayName,
        baseUrl: record.baseUrl ?? undefined,
        imageInput: record.imageInput,
        temperature: record.temperature ?? undefined,
        settings: getSettings(record),
        hasApiKey: record.encryptedApiKey !== null,
        apiKeyHint: apiKey ? maskApiKey(apiKey) : undefined,
        canEdit: canEditCustomModel(record, userId, role),
        createdByName: record.createdBy?.name ?? record.createdBy?.email ?? undefined,
        updatedAt: record.updatedAt.toISOString(),
    };
}

/**
 * Returns the custom models available to a user: the org's workspace models
 * and the user's personal models. Anonymous users (and background jobs) only get
 * workspace models.
 */
export const getCustomModelRecords = async ({
    prisma,
    orgId,
    userId,
}: {
    prisma: PrismaClient;
    orgId: number;
    userId: string | undefined;
}) => {
    return prisma.customLanguageModel.findMany({
        where: {
            orgId,
            OR: [
                { scope: 'WORKSPACE' },
                ...(userId ? [{ scope: 'PERSONAL' as const, createdById: userId }] : []),
            ],
        },
        include: { createdBy: { select: { name: true, email: true } } },
        // Workspace models first, then personal; alphabetical within each.
        orderBy: [{ scope: 'desc' }, { displayName: 'asc' }],
    });
}

/**
 * Custom models (as `LanguageModel` configs) available to a user.
 */
export const getCustomLanguageModels = async (params: {
    prisma: PrismaClient;
    orgId: number;
    userId: string | undefined;
}): Promise<LanguageModel[]> => {
    const records = await getCustomModelRecords(params);
    return records
        .map(toLanguageModelConfig)
        .filter((model) => model !== undefined);
}

/**
 * Workspace custom models, for contexts without a user (e.g. background jobs).
 */
export const getWorkspaceCustomLanguageModels = async (): Promise<LanguageModel[]> => {
    return getCustomLanguageModels({ prisma: __unsafePrisma, orgId: SINGLE_TENANT_ORG_ID, userId: undefined });
}

/**
 * Checks whether a display name is already used by another model the user (or,
 * for workspace models, any member) would see.
 */
export const isCustomModelDisplayNameTaken = async ({
    prisma,
    orgId,
    userId,
    scope,
    displayName,
    excludeId,
}: {
    prisma: PrismaClient;
    orgId: number;
    userId: string;
    scope: CustomLanguageModel['scope'];
    displayName: string;
    excludeId?: string;
}) => {
    const existing = await prisma.customLanguageModel.findFirst({
        where: {
            orgId,
            displayName: { equals: displayName, mode: 'insensitive' },
            ...(excludeId ? { id: { not: excludeId } } : {}),
            // Workspace models must not clash with any workspace model; personal models
            // must not clash with workspace models or the user's other personal models.
            OR: scope === 'WORKSPACE'
                ? [{ scope: 'WORKSPACE' }]
                : [{ scope: 'WORKSPACE' }, { scope: 'PERSONAL', createdById: userId }],
        },
        select: { id: true },
    });
    return existing !== null;
}
