import { SBChatMessage, SBChatMessageMetadata } from "@/features/chat/types";
import { getAnswerPartFromAssistantMessage } from "@/features/chat/utils";
import { getFileSource } from '@/features/git';
import { isServiceError } from "@/lib/utils";
import { LanguageModelV3 as AISDKLanguageModelV3 } from "@ai-sdk/provider";
import { ProviderOptions } from "@ai-sdk/provider-utils";
import { createLogger, env } from "@sourcebot/shared";
import {
    createUIMessageStream, JSONValue, LanguageModel, ModelMessage, StopCondition, streamText, StreamTextResult, Tool,
    UIMessageStreamOnFinishCallback,
    UIMessageStreamOptions,
    UIMessageStreamWriter
} from "ai";
import { randomUUID } from "crypto";
import _dedent from "dedent";
import { ANSWER_TAG, FILE_REFERENCE_PREFIX } from "./constants";
import { Source } from "./types";
import { addLineNumbers, fileReferenceToString } from "./utils";
import { createTools } from "./tools";
import { createCachingPrepareStep, createSystemMessage, getPromptCacheStrategy } from "./promptCaching";
import { formatAttachmentsForPrompt } from "./attachments";
import { describeOmittedImages } from "./imageAttachments";
import { createLoadSkillTool, LOAD_SKILL_TOOL_NAME, LoadableSkill } from "./skills/loadSkillTool";
import { formatInvokedSkillsForPrompt } from "./skills/skillUtils";
import { connectMcpServers, ConnectedMcpServer, getConfiguredMcpServers } from "./mcpConnectors/mcpConnectors.server";

const dedent = _dedent.withOptions({ alignValues: true });

const logger = createLogger('chat-agent');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergeStreamAsync = async (stream: StreamTextResult<any, any>, writer: UIMessageStreamWriter<SBChatMessage>, options: UIMessageStreamOptions<SBChatMessage> = {}) => {
    await new Promise<void>((resolve) => writer.merge(stream.toUIMessageStream({
        ...options,
        onFinish: async () => {
            resolve();
        }
    })));
}

interface CreateMessageStreamResponseProps {
    chatId: string;
    messages: SBChatMessage[];
    selectedRepos: string[];
    model: AISDKLanguageModelV3;
    modelName: string;
    onFinish: UIMessageStreamOnFinishCallback<SBChatMessage>;
    onError: (error: unknown) => string;
    modelProviderOptions?: Record<string, Record<string, JSONValue>>;
    modelTemperature?: number;
    metadata?: Partial<SBChatMessageMetadata>;
    /**
     * Skills visible to the user. Skills invoked in a message (via `/name`) are
     * resolved against this list; skills with `autoInvoke` can be loaded by the agent.
     */
    skills?: AgentSkill[];
    /** Whether the model accepts image input. Images are replaced by a note otherwise. */
    supportsImageInput?: boolean;
}

export type AgentSkill = LoadableSkill & { autoInvoke: boolean };

export const createMessageStream = async ({
    chatId,
    messages,
    metadata,
    selectedRepos,
    model,
    modelName,
    modelProviderOptions,
    modelTemperature,
    onFinish,
    onError,
    skills = [],
    supportsImageInput = false,
}: CreateMessageStreamResponseProps) => {
    const latestMessage = messages[messages.length - 1];
    const sources = latestMessage.parts
        .filter((part) => part.type === 'data-source')
        .map((part) => part.data);

    const traceId = randomUUID();

    // Extract user messages and assistant answers.
    // We will use this as the context we carry between messages.
    const messageHistory =
        messages.map((message): ModelMessage | undefined => {
            if (message.role === 'user') {
                const text = message.parts[0].type === 'text' ? message.parts[0].text : '';
                const attachments = message.parts
                    .filter((part) => part.type === 'data-attachment')
                    .map((part) => part.data);

                // Resolve invoked skills by id, falling back to name (e.g. if the skill was re-created).
                // Skills that no longer exist or are no longer visible to the user are skipped.
                const invokedSkills = message.parts
                    .filter((part) => part.type === 'data-skill')
                    .map(({ data }) => skills.find((skill) => skill.id === data.id) ?? skills.find((skill) => skill.name === data.name))
                    .filter((skill) => skill !== undefined);

                const images = message.parts
                    .filter((part) => part.type === 'data-image')
                    .map((part) => part.data);

                const content = [
                    text,
                    formatInvokedSkillsForPrompt(invokedSkills),
                    formatAttachmentsForPrompt(attachments),
                    supportsImageInput ? '' : describeOmittedImages(images),
                ].filter((section) => section.length > 0).join('\n\n');

                if (supportsImageInput && images.length > 0) {
                    return {
                        role: 'user',
                        content: [
                            { type: 'text', text: content },
                            ...images.map((image) => ({
                                type: 'image' as const,
                                image: image.data,
                                mediaType: image.mediaType,
                            })),
                        ],
                    };
                }

                return {
                    role: 'user',
                    content,
                };
            }

            if (message.role === 'assistant') {
                const answerPart = getAnswerPartFromAssistantMessage(message, false);
                if (answerPart) {
                    return {
                        role: 'assistant',
                        content: [answerPart]
                    }
                }
            }
        }).filter(message => message !== undefined);

    const stream = createUIMessageStream<SBChatMessage>({
        execute: async ({ writer }) => {
            writer.write({
                type: 'start',
            });

            const startTime = new Date();

            // Connect to third-party MCP servers configured in config.json.
            const mcpServers = await getConfiguredMcpServers();
            const mcpConnectors = mcpServers.length > 0 ? await connectMcpServers(mcpServers) : undefined;

            try {
                const researchStream = await createAgentStream({
                    model,
                    providerOptions: modelProviderOptions,
                    temperature: modelTemperature,
                    inputMessages: messageHistory,
                    inputSources: sources,
                    selectedRepos,
                    onWriteSource: (source) => {
                        writer.write({
                            type: 'data-source',
                            data: source,
                        });
                    },
                    traceId,
                    chatId,
                    autoInvokableSkills: skills.filter((skill) => skill.autoInvoke),
                    externalTools: mcpConnectors?.tools ?? {},
                    externalServers: mcpConnectors?.servers ?? [],
                });

                await mergeStreamAsync(researchStream, writer, {
                    sendReasoning: true,
                    sendStart: false,
                    sendFinish: false,
                });

                const totalUsage = await researchStream.totalUsage;

                writer.write({
                    type: 'message-metadata',
                    messageMetadata: {
                        totalTokens: totalUsage.totalTokens,
                        totalInputTokens: totalUsage.inputTokens,
                        totalOutputTokens: totalUsage.outputTokens,
                        totalCacheReadTokens: totalUsage.inputTokenDetails?.cacheReadTokens,
                        totalCacheWriteTokens: totalUsage.inputTokenDetails?.cacheWriteTokens,
                        totalResponseTimeMs: new Date().getTime() - startTime.getTime(),
                        modelName,
                        traceId,
                        ...metadata,
                    }
                });
            } finally {
                await mcpConnectors?.close();
            }

            writer.write({
                type: 'finish',
            });
        },
        onError,
        originalMessages: messages,
        onFinish,
    });

    return stream;
};

interface AgentOptions {
    model: LanguageModel;
    providerOptions?: ProviderOptions;
    temperature?: number;
    selectedRepos: string[];
    inputMessages: ModelMessage[];
    inputSources: Source[];
    onWriteSource: (source: Source) => void;
    traceId: string;
    chatId: string;
    autoInvokableSkills: LoadableSkill[];
    /** Tools from third-party MCP servers. */
    externalTools: Record<string, Tool>;
    externalServers: ConnectedMcpServer[];
}

const createAgentStream = async ({
    model,
    providerOptions,
    temperature,
    inputMessages,
    inputSources,
    selectedRepos,
    onWriteSource,
    traceId,
    chatId,
    autoInvokableSkills,
    externalTools,
    externalServers,
}: AgentOptions) => {
    // For every file source, resolve the source code so that we can include it in the system prompt.
    const fileSources = inputSources.filter((source) => source.type === 'file');
    const resolvedFileSources = (
        await Promise.all(fileSources.map(async (source) => {
            const fileSource = await getFileSource({
                path: source.path,
                repo: source.repo,
                ref: source.revision,
            }, { source: 'sourcebot-ask-agent' });

            if (isServiceError(fileSource)) {
                logger.error("Error fetching file source:", fileSource);
                return undefined;
            }

            return {
                path: fileSource.path,
                source: fileSource.source,
                repo: fileSource.repo,
                language: fileSource.language,
                revision: source.revision,
            };
        }))
    ).filter((source) => source !== undefined);

    const systemPrompt = createPrompt({
        repos: selectedRepos,
        files: resolvedFileSources,
        skills: autoInvokableSkills,
        externalServers,
    });

    const tools = {
        ...createTools({ source: 'sourcebot-ask-agent', selectedRepos }),
        [LOAD_SKILL_TOOL_NAME]: createLoadSkillTool(autoInvokableSkills),
        ...externalTools,
    };

    const cacheStrategy = env.SOURCEBOT_CHAT_PROMPT_CACHING_ENABLED === 'true'
        ? getPromptCacheStrategy(model)
        : undefined;

    const stream = streamText({
        model,
        providerOptions,
        messages: inputMessages,
        system: createSystemMessage(systemPrompt, cacheStrategy),
        prepareStep: cacheStrategy ? createCachingPrepareStep(cacheStrategy) : undefined,
        tools,
        // Only expose `load_skill` when there are skills to load.
        activeTools: autoInvokableSkills.length > 0
            ? undefined
            : (Object.keys(tools) as (keyof typeof tools)[]).filter((name) => name !== LOAD_SKILL_TOOL_NAME),
        temperature: temperature ?? env.SOURCEBOT_CHAT_MODEL_TEMPERATURE,
        stopWhen: [
            stepCountIsGTE(env.SOURCEBOT_CHAT_MAX_STEP_COUNT),
        ],
        toolChoice: "auto",
        onStepFinish: ({ toolResults }) => {
            toolResults.forEach(({ output, dynamic }) => {
                if (dynamic || isServiceError(output)) {
                    return;
                }

                output.sources?.forEach(onWriteSource);
            });
        },
        experimental_telemetry: {
            isEnabled: env.SOURCEBOT_TELEMETRY_PII_COLLECTION_ENABLED === 'true',
            metadata: {
                langfuseTraceId: traceId,
            },
        },
        onError: (error) => {
            logger.error(error);
        },
    });

    return stream;
}

const createPrompt = ({
    files,
    repos,
    skills,
    externalServers,
}: {
    skills: LoadableSkill[],
    externalServers: ConnectedMcpServer[],
    files?: {
        path: string;
        source: string;
        repo: string;
        language: string;
        revision: string;
    }[],
    repos: string[],
}) => {
    return dedent`
    You are a powerful agentic AI code assistant built into NexusCode, a code-intelligence platform. Your job is to help developers understand and navigate their large codebases.

    <workflow>
    Your workflow has two distinct phases:

    **Phase 1: Research & Analysis**
    - Analyze the user's question and determine what context you need
    - Use available tools to gather code, search repositories, find references, etc.
    - Think through the problem and collect all relevant information
    - Do NOT provide partial answers or explanations during this phase

    **Phase 2: Structured Response**
    - **MANDATORY**: You MUST always enter this phase and provide a structured markdown response, regardless of whether phase 1 was completed or interrupted
    - Provide your final response based on whatever context you have available
    - Always format your response according to the required response format below
    </workflow>

    <research_phase_instructions>
    During the research phase, use the tools available to you to gather comprehensive context before answering. Always explain why you're using each tool. Depending on the user's question, you may need to use multiple tools. If the question is vague, ask the user for more information.
    </research_phase_instructions>

    ${repos.length > 0 ? dedent`
        <selected_repositories>
        The user has explicitly selected the following repositories for analysis:
        ${repos.map(repo => `- ${repo}`).join('\n')}

        When calling tools that accept a \`repo\` parameter (e.g. \`read_file\`, \`list_commits\`, \`list_tree\`, \`get_diff\`, \`grep\`), use these repository names exactly as listed above, including the full host prefix (e.g. \`github.com/org/repo\`).

        When using \`grep\` to search across ALL selected repositories (e.g. "which repos have X?"), omit the \`repo\` parameter entirely — the tool will automatically search across all selected repositories in a single call. Do NOT call \`grep\` once per repository when a single broad search would suffice.
        </selected_repositories>
    ` : ''}

    ${(files && files.length > 0) ? dedent`
        <files>
        The user has mentioned the following files, which are automatically included for analysis.

        ${files?.map(file => `<file path="${file.path}" repository="${file.repo}" language="${file.language}" revision="${file.revision}">
            ${addLineNumbers(file.source)}
            </file>`).join('\n\n')}
        </files>
    `: ''}

    ${skills.length > 0 ? dedent`
        <available_skills>
        Skills are reusable instructions written by your users. When the user's request matches a skill's description, call \`${LOAD_SKILL_TOOL_NAME}\` with the skill's name BEFORE doing the work, then follow the loaded instructions. Do not load skills that are not relevant. Skills the user invoked explicitly are already included in their message inside <invoked_skills>; do not load those again.

        ${skills.map((skill) => `- ${skill.name}: ${skill.description.replace(/\s+/g, ' ')}`).join('\n')}
        </available_skills>
    ` : ''}

    ${externalServers.length > 0 ? dedent`
        <external_tools>
        In addition to the code tools, you have tools from the following external MCP servers. Their tool names are prefixed with the server name (e.g. \`server__tool\`). Use them when the user's question involves information from these systems (for example issues, documentation or internal services) rather than the code itself. Results from external tools are not code in the indexed repositories, so do not cite them with \`${FILE_REFERENCE_PREFIX}\` references; mention the source by name or link instead.

        ${externalServers.map((server) => `- ${server.name}${server.description ? `: ${server.description.replace(/\s+/g, ' ')}` : ''}`).join('\n')}
        </external_tools>
    ` : ''}

    <answer_instructions>
    When you have sufficient context, output your answer as a structured markdown response.

    **Required Response Format:**
    - **CRITICAL**: You MUST always prefix your answer with a \`${ANSWER_TAG}\` tag at the very top of your response
    - **CRITICAL**: You MUST provide your complete response in markdown format with embedded code references
    - **CODE REFERENCE REQUIREMENT**: Whenever you mention, discuss, or refer to ANY specific part of the code (files, functions, variables, methods, classes, imports, etc.), you MUST immediately follow with a code reference using the format \`${fileReferenceToString({ repo: 'repository', path: 'filename' })}\` or \`${fileReferenceToString({ repo: 'repository', path: 'filename', range: { startLine: 1, endLine: 10 } })}\` (where the numbers are the start and end line numbers of the code snippet). This includes:
    - Files (e.g., "The \`auth.ts\` file" → must include \`${fileReferenceToString({ repo: 'repository', path: 'auth.ts' })}\`)
    - Function names (e.g., "The \`getRepos()\` function" → must include \`${fileReferenceToString({ repo: 'repository', path: 'auth.ts', range: { startLine: 15, endLine: 20 } })}\`)
    - Variable names (e.g., "The \`suggestionQuery\` variable" → must include \`${fileReferenceToString({ repo: 'repository', path: 'search.ts', range: { startLine: 42, endLine: 42 } })}\`)
    - Any code snippet or line you're explaining
    - Class names, method calls, imports, etc.
    - Some examples of both correct and incorrect code references:
    - Correct: @file:{repository::path/to/file.ts}
    - Correct: @file:{repository::path/to/file.ts:10-15}
    - Incorrect: @file{repository::path/to/file.ts} (missing colon)
    - Incorrect: @file:repository::path/to/file.ts (missing curly braces)
    - Incorrect: @file:{repository::path/to/file.ts:10-25,30-35} (multiple ranges not supported)
    - Incorrect: @file:{path/to/file.ts} (missing repository)
    - Be clear and very concise. Use bullet points where appropriate
    - Do NOT explain code without providing the exact location reference. Every code mention requires a corresponding \`${FILE_REFERENCE_PREFIX}\` reference
    - If you cannot provide a code reference for something you're discussing, do not mention that specific code element
    - Always prefer to use \`${FILE_REFERENCE_PREFIX}\` over \`\`\`code\`\`\` blocks.
    - When a diagram would make the answer clearer (e.g. call flows, request lifecycles, component/module relationships, state machines, class or entity relationships), include it as a fenced \`\`\`mermaid\`\`\` code block. Keep diagrams focused, quote node labels that contain special characters, and do NOT put \`${FILE_REFERENCE_PREFIX}\` references inside the diagram; reference the code in the surrounding text instead.

    **Example answer structure:**
    \`\`\`markdown
    ${ANSWER_TAG}
    Authentication in Sourcebot is built on NextAuth.js with a session-based approach using JWT tokens and Prisma as the database adapter ${fileReferenceToString({ repo: 'github.com/sourcebot-dev/sourcebot', path: 'auth.ts', range: { startLine: 135, endLine: 140 } })}. The system supports multiple authentication providers and implements organization-based authorization with role-defined permissions.
    \`\`\`
    </answer_instructions>
    `
}

// If the agent exceeds the step count, then we will stop.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stepCountIsGTE = (stepCount: number): StopCondition<any> => {
    return ({ steps }) => steps.length >= stepCount;
}
