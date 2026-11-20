import { z } from "zod";

/**
 * Language models configured from the settings UI ("custom models"), in addition
 * to the models defined in the config file.
 *
 * This module is shared between the client and the server.
 */

/** Providers that can be configured from the settings UI (API key based). */
export const CUSTOM_MODEL_PROVIDERS = [
    'anthropic',
    'openai',
    'openai-compatible',
    'deepseek',
    'google-generative-ai',
    'azure',
    'openrouter',
    'xai',
    'mistral',
] as const;
export type CustomModelProvider = typeof CUSTOM_MODEL_PROVIDERS[number];

export const CUSTOM_MODEL_PROVIDER_INFO: Record<CustomModelProvider, {
    label: string;
    modelPlaceholder: string;
    /** Environment variable used when no API key is set. */
    apiKeyEnvVar?: string;
    baseUrlRequired?: boolean;
    baseUrlPlaceholder?: string;
}> = {
    'anthropic': { label: 'Anthropic', modelPlaceholder: 'claude-sonnet-4-5', apiKeyEnvVar: 'ANTHROPIC_API_KEY', baseUrlPlaceholder: 'https://api.anthropic.com/v1' },
    'openai': { label: 'OpenAI', modelPlaceholder: 'gpt-5', apiKeyEnvVar: 'OPENAI_API_KEY', baseUrlPlaceholder: 'https://api.openai.com/v1' },
    'openai-compatible': { label: 'OpenAI compatible', modelPlaceholder: 'qwen3-coder', baseUrlRequired: true, baseUrlPlaceholder: 'https://example.com/v1' },
    'deepseek': { label: 'DeepSeek', modelPlaceholder: 'deepseek-chat', apiKeyEnvVar: 'DEEPSEEK_API_KEY' },
    'google-generative-ai': { label: 'Google Gemini', modelPlaceholder: 'gemini-2.5-pro', apiKeyEnvVar: 'GOOGLE_GENERATIVE_AI_API_KEY' },
    'azure': { label: 'Azure OpenAI', modelPlaceholder: 'my-gpt-deployment', apiKeyEnvVar: 'AZURE_API_KEY' },
    'openrouter': { label: 'OpenRouter', modelPlaceholder: 'anthropic/claude-sonnet-4.5', apiKeyEnvVar: 'OPENROUTER_API_KEY' },
    'xai': { label: 'xAI', modelPlaceholder: 'grok-4', apiKeyEnvVar: 'XAI_API_KEY' },
    'mistral': { label: 'Mistral', modelPlaceholder: 'mistral-large-latest', apiKeyEnvVar: 'MISTRAL_API_KEY' },
};

export const customModelScopeSchema = z.enum(['PERSONAL', 'WORKSPACE']);
export type CustomModelScope = z.infer<typeof customModelScopeSchema>;

export const customModelSettingsSchema = z.object({
    /** Anthropic: send the key as `x-api-key` (default) or as `Authorization: Bearer`. */
    authType: z.enum(['api-key', 'bearer']).optional(),
    /** Azure: resource name (ignored when a base URL is set). */
    resourceName: z.string().trim().max(200).optional(),
    /** Azure: API version. */
    apiVersion: z.string().trim().max(50).optional(),
    /** OpenAI compatible: tag used to extract reasoning, e.g. `think`. */
    reasoningTag: z.string().trim().max(50).optional(),
});
export type CustomModelSettings = z.infer<typeof customModelSettingsSchema>;

const optionalTrimmedString = (max: number) => z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const customModelInputSchema = z.object({
    scope: customModelScopeSchema,
    provider: z.enum(CUSTOM_MODEL_PROVIDERS),
    model: z.string().trim().min(1, 'Model is required.').max(200),
    displayName: z.string().trim().min(1, 'Display name is required.').max(100),
    baseUrl: optionalTrimmedString(500).refine(
        (value) => value === undefined || /^https?:\/\/[^\s/$.?#].[^\s]*$/.test(value),
        'Base URL must be an http(s) URL.',
    ),
    /**
     * Write-only. When updating: `undefined` keeps the existing key, an empty
     * string removes it.
     */
    apiKey: z.string().trim().max(1000).optional(),
    imageInput: z.boolean(),
    temperature: z.number().min(0).max(2).optional(),
    settings: customModelSettingsSchema.default({}),
}).superRefine((value, ctx) => {
    if (CUSTOM_MODEL_PROVIDER_INFO[value.provider].baseUrlRequired && !value.baseUrl) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseUrl'], message: 'Base URL is required for this provider.' });
    }
    if (value.provider === 'azure' && !value.baseUrl && !value.settings.resourceName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['settings', 'resourceName'], message: 'Resource name or base URL is required for Azure OpenAI.' });
    }
});
export type CustomModelInput = z.input<typeof customModelInputSchema>;
export type ParsedCustomModelInput = z.output<typeof customModelInputSchema>;

/** A custom model as returned to the client. Never includes the API key. */
export type CustomModelInfo = {
    id: string;
    scope: CustomModelScope;
    provider: CustomModelProvider;
    model: string;
    displayName: string;
    baseUrl?: string;
    imageInput: boolean;
    temperature?: number;
    settings: CustomModelSettings;
    hasApiKey: boolean;
    /** Last 4 characters of the API key, for identification. */
    apiKeyHint?: string;
    canEdit: boolean;
    createdByName?: string;
    updatedAt: string;
};

/** A model defined in the config file, as shown (read-only) in the settings UI. */
export type ConfigFileModelInfo = {
    provider: string;
    model: string;
    displayName?: string;
    imageInput: boolean;
};

export type ListCustomModelsResponse = {
    customModels: CustomModelInfo[];
    configFileModels: ConfigFileModelInfo[];
};

export const maskApiKey = (apiKey: string) => apiKey.length >= 8 ? apiKey.slice(-4) : undefined;
