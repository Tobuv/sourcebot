import { LanguageModel, ModelMessage, SystemModelMessage } from "ai";
import { ProviderOptions } from "@ai-sdk/provider-utils";

/**
 * Prompt caching for the Ask agent.
 *
 * Providers such as Anthropic require explicit cache breakpoints: everything in
 * the prompt up to (and including) a marked block is cached and billed at a
 * discounted rate when a later request starts with the same prefix.
 *
 * The agent loop re-sends the whole conversation on every step (tool definitions,
 * system prompt, message history and all previous tool calls / results), so
 * marking the right blocks lets each step reuse the prefix written by the
 * previous one instead of paying full price for it again.
 */

type PromptCacheStrategy = 'anthropic' | 'bedrock';

const CACHE_BREAKPOINT_OPTIONS: Record<PromptCacheStrategy, ProviderOptions> = {
    anthropic: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
    },
    bedrock: {
        bedrock: { cachePoint: { type: 'default' } },
    },
};

/**
 * Returns the caching strategy for the given model, or `undefined` if the model's
 * provider does not support explicit cache breakpoints (in which case the provider
 * may still cache automatically, e.g. OpenAI).
 */
export const getPromptCacheStrategy = (model: LanguageModel): PromptCacheStrategy | undefined => {
    if (typeof model === 'string') {
        return undefined;
    }

    switch (model.provider) {
        // Anthropic API and Claude on Vertex AI share the Anthropic messages format.
        case 'anthropic.messages':
        case 'vertex.anthropic.messages':
            return 'anthropic';
        case 'amazon-bedrock':
            // Only Claude models on Bedrock support cache points in the Converse API
            // in a way that is compatible with this strategy.
            return model.modelId.includes('anthropic.claude') ? 'bedrock' : undefined;
        default:
            return undefined;
    }
}

const mergeProviderOptions = (
    existing: ProviderOptions | undefined,
    addition: ProviderOptions,
): ProviderOptions => {
    const merged: ProviderOptions = { ...existing };
    for (const [provider, options] of Object.entries(addition)) {
        merged[provider] = { ...merged[provider], ...options };
    }
    return merged;
}

export const withCacheBreakpoint = <T extends ModelMessage>(message: T, strategy: PromptCacheStrategy): T => {
    return {
        ...message,
        providerOptions: mergeProviderOptions(message.providerOptions, CACHE_BREAKPOINT_OPTIONS[strategy]),
    };
}

/**
 * Builds the system message. Tool definitions are sent before the system prompt,
 * so a breakpoint here caches both.
 */
export const createSystemMessage = (content: string, strategy: PromptCacheStrategy | undefined): string | SystemModelMessage => {
    if (!strategy) {
        return content;
    }

    return withCacheBreakpoint({ role: 'system', content }, strategy);
}

/**
 * Creates a `prepareStep` handler that marks cache breakpoints on the conversation
 * for each agent step:
 *
 * - The last message of the current step, so the next step can read everything
 *   up to here from the cache.
 * - The last message of the previous step, so this step reads the prefix that the
 *   previous step wrote. (Anthropic only looks back a limited number of blocks for
 *   cache hits, and one step can append many tool calls/results.)
 *
 * Together with the system message breakpoint this uses at most 3 of Anthropic's
 * 4 allowed breakpoints.
 */
export const createCachingPrepareStep = (strategy: PromptCacheStrategy) => {
    let previousStepLastIndex: number | undefined;

    return ({ messages }: { messages: ModelMessage[] }) => {
        if (messages.length === 0) {
            return {};
        }

        const lastIndex = messages.length - 1;
        const breakpointIndices = new Set([lastIndex]);
        if (previousStepLastIndex !== undefined && previousStepLastIndex < lastIndex) {
            breakpointIndices.add(previousStepLastIndex);
        }
        previousStepLastIndex = lastIndex;

        return {
            messages: messages.map((message, index) =>
                breakpointIndices.has(index) ? withCacheBreakpoint(message, strategy) : message
            ),
        };
    }
}
