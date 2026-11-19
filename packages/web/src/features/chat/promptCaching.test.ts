import { describe, expect, test } from 'vitest';
import { LanguageModel, ModelMessage } from 'ai';
import { createCachingPrepareStep, createSystemMessage, getPromptCacheStrategy, withCacheBreakpoint } from './promptCaching';

const fakeModel = (provider: string, modelId: string) => ({ provider, modelId }) as unknown as LanguageModel;

const ANTHROPIC_BREAKPOINT = { anthropic: { cacheControl: { type: 'ephemeral' } } };

const userMessage = (text: string): ModelMessage => ({ role: 'user', content: text });

const breakpointIndices = (messages: ModelMessage[]) =>
    messages
        .map((message, index) => message.providerOptions?.anthropic ? index : -1)
        .filter((index) => index !== -1);

describe('getPromptCacheStrategy', () => {
    test('detects Anthropic and Vertex Anthropic models', () => {
        expect(getPromptCacheStrategy(fakeModel('anthropic.messages', 'claude-sonnet-4-5'))).toBe('anthropic');
        expect(getPromptCacheStrategy(fakeModel('vertex.anthropic.messages', 'claude-sonnet-4-5'))).toBe('anthropic');
    });

    test('detects Claude on Bedrock only', () => {
        expect(getPromptCacheStrategy(fakeModel('amazon-bedrock', 'us.anthropic.claude-sonnet-4-5-v1:0'))).toBe('bedrock');
        expect(getPromptCacheStrategy(fakeModel('amazon-bedrock', 'meta.llama3-70b-instruct-v1:0'))).toBeUndefined();
    });

    test('returns undefined for other providers and string model ids', () => {
        expect(getPromptCacheStrategy(fakeModel('openai.responses', 'gpt-5'))).toBeUndefined();
        expect(getPromptCacheStrategy('anthropic/claude-sonnet-4-5')).toBeUndefined();
    });
});

describe('withCacheBreakpoint', () => {
    test('preserves existing provider options', () => {
        const message: ModelMessage = {
            role: 'user',
            content: 'hi',
            providerOptions: { anthropic: { foo: 'bar' }, openai: { baz: 1 } },
        };

        expect(withCacheBreakpoint(message, 'anthropic').providerOptions).toEqual({
            anthropic: { foo: 'bar', cacheControl: { type: 'ephemeral' } },
            openai: { baz: 1 },
        });
        // Does not mutate the input.
        expect(message.providerOptions).toEqual({ anthropic: { foo: 'bar' }, openai: { baz: 1 } });
    });

    test('uses a cache point for bedrock', () => {
        expect(withCacheBreakpoint(userMessage('hi'), 'bedrock').providerOptions).toEqual({
            bedrock: { cachePoint: { type: 'default' } },
        });
    });
});

describe('createSystemMessage', () => {
    test('returns a plain string when caching is disabled', () => {
        expect(createSystemMessage('prompt', undefined)).toBe('prompt');
    });

    test('returns a system message with a breakpoint when caching is enabled', () => {
        expect(createSystemMessage('prompt', 'anthropic')).toEqual({
            role: 'system',
            content: 'prompt',
            providerOptions: ANTHROPIC_BREAKPOINT,
        });
    });
});

describe('createCachingPrepareStep', () => {
    test('marks the last message on the first step', () => {
        const prepareStep = createCachingPrepareStep('anthropic');
        const result = prepareStep({ messages: [userMessage('a'), userMessage('b')] });
        expect(breakpointIndices(result.messages!)).toEqual([1]);
    });

    test('marks the previous and current step boundaries on later steps', () => {
        const prepareStep = createCachingPrepareStep('anthropic');
        prepareStep({ messages: [userMessage('a')] });
        prepareStep({ messages: [userMessage('a'), userMessage('b'), userMessage('c')] });
        const result = prepareStep({
            messages: [userMessage('a'), userMessage('b'), userMessage('c'), userMessage('d'), userMessage('e')],
        });
        expect(breakpointIndices(result.messages!)).toEqual([2, 4]);
    });

    test('does not mutate the input messages', () => {
        const prepareStep = createCachingPrepareStep('anthropic');
        const messages = [userMessage('a')];
        prepareStep({ messages });
        expect(messages[0].providerOptions).toBeUndefined();
    });

    test('handles an empty message list', () => {
        const prepareStep = createCachingPrepareStep('anthropic');
        expect(prepareStep({ messages: [] })).toEqual({});
    });
});
