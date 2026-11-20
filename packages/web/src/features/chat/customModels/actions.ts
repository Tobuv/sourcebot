'use server';

import { ErrorCode } from "@/lib/errorCodes";
import { notFound, requestBodySchemaValidationError, ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { CustomLanguageModel, OrgRole, Prisma } from "@sourcebot/db";
import { generateText } from "ai";
import { StatusCodes } from "http-status-codes";
import { getAISDKLanguageModelAndOptions, getConfigFileLanguageModels } from "../utils.server";
import {
    canEditCustomModel,
    encryptApiKey,
    isCustomModelDisplayNameTaken,
    toCustomModelInfo,
    toLanguageModelConfig,
} from "./customModels.server";
import { CustomModelInfo, CustomModelInput, customModelInputSchema, ParsedCustomModelInput } from "./customModelUtils";

const TEST_TIMEOUT_MS = 60_000;

const forbidden = (message: string): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message,
});

const badRequest = (message: string): ServiceError => ({
    statusCode: StatusCodes.BAD_REQUEST,
    errorCode: ErrorCode.INVALID_REQUEST_BODY,
    message,
});

const WORKSPACE_OWNER_ONLY = "Only workspace owners can manage workspace models.";

const toRecordData = (data: ParsedCustomModelInput) => ({
    scope: data.scope,
    provider: data.provider,
    model: data.model,
    displayName: data.displayName,
    baseUrl: data.baseUrl ?? null,
    imageInput: data.imageInput,
    temperature: data.temperature ?? null,
    settings: data.settings as Prisma.InputJsonValue,
});

/** Display names must also not clash with models from the config file. */
const isConfigFileDisplayName = async (displayName: string) => {
    const models = await getConfigFileLanguageModels();
    return models.some((model) => (model.displayName ?? model.model).toLowerCase() === displayName.toLowerCase());
}

/** Finds a custom model the current user may see. Other users' personal models are treated as not found. */
const findVisibleModel = async (prisma: Parameters<Parameters<typeof withAuth>[0]>[0]['prisma'], orgId: number, userId: string, id: string) => {
    const record = await prisma.customLanguageModel.findFirst({ where: { id, orgId } });
    if (!record || (record.scope === 'PERSONAL' && record.createdById !== userId)) {
        return undefined;
    }
    return record;
}

export const createCustomModel = async (input: CustomModelInput): Promise<CustomModelInfo | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const parsed = customModelInputSchema.safeParse(input);
        if (!parsed.success) {
            return requestBodySchemaValidationError(parsed.error);
        }
        const data = parsed.data;

        if (data.scope === 'WORKSPACE' && role !== OrgRole.OWNER) {
            return forbidden(WORKSPACE_OWNER_ONLY);
        }

        if (await isConfigFileDisplayName(data.displayName) ||
            await isCustomModelDisplayNameTaken({ prisma, orgId: org.id, userId: user.id, scope: data.scope, displayName: data.displayName })) {
            return badRequest(`A model named "${data.displayName}" already exists.`);
        }

        const record = await prisma.customLanguageModel.create({
            data: {
                ...toRecordData(data),
                encryptedApiKey: data.apiKey ? encryptApiKey(data.apiKey) : null,
                orgId: org.id,
                createdById: user.id,
            },
            include: { createdBy: { select: { name: true, email: true } } },
        });

        return toCustomModelInfo(record, user.id, role);
    })
);

export const updateCustomModel = async (id: string, input: CustomModelInput): Promise<CustomModelInfo | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const parsed = customModelInputSchema.safeParse(input);
        if (!parsed.success) {
            return requestBodySchemaValidationError(parsed.error);
        }
        const data = parsed.data;

        const existing = await findVisibleModel(prisma, org.id, user.id, id);
        if (!existing) {
            return notFound();
        }

        if (!canEditCustomModel(existing, user.id, role) || (data.scope === 'WORKSPACE' && role !== OrgRole.OWNER)) {
            return forbidden(WORKSPACE_OWNER_ONLY);
        }

        if (await isConfigFileDisplayName(data.displayName) ||
            await isCustomModelDisplayNameTaken({ prisma, orgId: org.id, userId: user.id, scope: data.scope, displayName: data.displayName, excludeId: id })) {
            return badRequest(`A model named "${data.displayName}" already exists.`);
        }

        const record = await prisma.customLanguageModel.update({
            where: { id },
            data: {
                ...toRecordData(data),
                // undefined keeps the existing key, an empty string removes it.
                ...(data.apiKey !== undefined ? { encryptedApiKey: data.apiKey ? encryptApiKey(data.apiKey) : null } : {}),
                // Moving a workspace model into a personal scope makes it owned by the current user.
                ...(data.scope === 'PERSONAL' && existing.scope !== 'PERSONAL' ? { createdById: user.id } : {}),
            },
            include: { createdBy: { select: { name: true, email: true } } },
        });

        return toCustomModelInfo(record, user.id, role);
    })
);

export const deleteCustomModel = async (id: string): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const existing = await findVisibleModel(prisma, org.id, user.id, id);
        if (!existing) {
            return notFound();
        }

        if (!canEditCustomModel(existing, user.id, role)) {
            return forbidden(WORKSPACE_OWNER_ONLY);
        }

        await prisma.customLanguageModel.delete({ where: { id } });
        return { success: true };
    })
);

export type TestCustomModelResult =
    | { success: true, latencyMs: number, response: string }
    | { success: false, message: string };

/**
 * Sends a tiny request to the model to check the configuration. When `id` is set
 * and no API key is provided, the saved key of that model is used.
 */
export const testCustomModel = async (input: CustomModelInput, id?: string): Promise<TestCustomModelResult | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const parsed = customModelInputSchema.safeParse(input);
        if (!parsed.success) {
            return requestBodySchemaValidationError(parsed.error);
        }
        const data = parsed.data;

        let encryptedApiKey: string | null = data.apiKey ? encryptApiKey(data.apiKey) : null;
        if (data.apiKey === undefined && id) {
            const existing = await findVisibleModel(prisma, org.id, user.id, id);
            if (!existing) {
                return notFound();
            }
            // Only people who can edit a model may use its saved key with other settings.
            if (!canEditCustomModel(existing, user.id, role)) {
                return forbidden(WORKSPACE_OWNER_ONLY);
            }
            encryptedApiKey = existing.encryptedApiKey;
        }

        const config = toLanguageModelConfig({
            ...toRecordData(data),
            encryptedApiKey,
        } as CustomLanguageModel);
        if (!config) {
            return badRequest(`Unsupported provider "${data.provider}".`);
        }

        const startTime = Date.now();
        try {
            const { model, providerOptions } = await getAISDKLanguageModelAndOptions(config);
            const result = await generateText({
                model,
                providerOptions,
                prompt: 'Reply with exactly: OK',
                abortSignal: AbortSignal.timeout(TEST_TIMEOUT_MS),
            });
            return {
                success: true,
                latencyMs: Date.now() - startTime,
                response: result.text.trim().slice(0, 200),
            } satisfies TestCustomModelResult;
        } catch (error) {
            return {
                success: false,
                message: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
            } satisfies TestCustomModelResult;
        }
    })
);
