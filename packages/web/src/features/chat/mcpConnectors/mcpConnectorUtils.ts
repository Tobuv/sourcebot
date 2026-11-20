/**
 * Pure helpers for exposing tools from third-party MCP servers to the Ask agent.
 * Shared between the client (tool call rendering) and the server.
 */

/** Separator between the server name and the tool name, e.g. `jira__search_issues`. */
export const MCP_TOOL_NAME_SEPARATOR = '__';

/** Most providers limit tool names to 64 characters of [a-zA-Z0-9_-]. */
const MAX_TOOL_NAME_LENGTH = 64;

/** Tool results larger than this are truncated to protect the model's context window. */
export const MAX_MCP_TOOL_OUTPUT_CHARS = 50_000;

/** The value returned by an MCP tool in the Ask agent (and stored in the chat history). */
export type McpToolOutput = {
    server: string;
    tool: string;
    /** Text passed to the model. */
    output: string;
    isError: boolean;
};

/** Subset of the MCP `CallToolResult` that we handle. */
export type McpToolResult = {
    content?: Array<
        | { type: 'text', text: string }
        | { type: 'image', mimeType?: string }
        | { type: 'audio', mimeType?: string }
        | { type: 'resource', resource: { uri: string, text?: string, mimeType?: string } }
        | { type: 'resource_link', uri: string, name?: string }
        | { type: string }
    >;
    structuredContent?: unknown;
    isError?: boolean;
};

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

/**
 * Builds a provider-safe, unique tool name from the server and tool names.
 */
export const toMcpToolName = (serverName: string, toolName: string, existingNames: Set<string>) => {
    const base = `${sanitize(serverName)}${MCP_TOOL_NAME_SEPARATOR}${sanitize(toolName)}`.slice(0, MAX_TOOL_NAME_LENGTH);

    let name = base;
    let suffix = 2;
    while (existingNames.has(name)) {
        const suffixText = `_${suffix++}`;
        name = `${base.slice(0, MAX_TOOL_NAME_LENGTH - suffixText.length)}${suffixText}`;
    }
    return name;
}

export const shouldExposeMcpTool = (
    toolName: string,
    { includeTools, excludeTools }: { includeTools?: string[], excludeTools?: string[] },
) => {
    if (includeTools && includeTools.length > 0 && !includeTools.includes(toolName)) {
        return false;
    }
    return !(excludeTools ?? []).includes(toolName);
}

/**
 * Converts an MCP tool result into text for the model.
 */
export const formatMcpToolResult = (result: McpToolResult): { output: string, isError: boolean } => {
    const parts: string[] = [];

    for (const item of result.content ?? []) {
        switch (item.type) {
            case 'text':
                parts.push((item as { text: string }).text);
                break;
            case 'resource': {
                const { resource } = item as { resource: { uri: string, text?: string } };
                parts.push(resource.text !== undefined ? `Resource ${resource.uri}:\n${resource.text}` : `[Resource: ${resource.uri}]`);
                break;
            }
            case 'resource_link': {
                const link = item as { uri: string, name?: string };
                parts.push(`[Resource link: ${link.name ? `${link.name} ` : ''}${link.uri}]`);
                break;
            }
            default:
                // Images, audio, etc. are not passed to the model.
                parts.push(`[${item.type} content omitted]`);
        }
    }

    if (parts.length === 0 && result.structuredContent !== undefined) {
        parts.push(JSON.stringify(result.structuredContent, null, 2));
    }

    let output = parts.join('\n\n');
    if (output.length > MAX_MCP_TOOL_OUTPUT_CHARS) {
        output = `${output.slice(0, MAX_MCP_TOOL_OUTPUT_CHARS)}\n\n[Output truncated: ${output.length - MAX_MCP_TOOL_OUTPUT_CHARS} more characters]`;
    }

    const isError = result.isError === true;
    if (isError) {
        output = `Tool returned an error:\n${output}`;
    }

    return { output: output || '(empty result)', isError };
}
