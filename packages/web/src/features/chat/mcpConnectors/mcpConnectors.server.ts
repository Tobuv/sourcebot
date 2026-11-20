import 'server-only';

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServer } from "@sourcebot/schemas/v3/index.type";
import { createLogger, env, getTokenFromConfig, loadConfig } from "@sourcebot/shared";
import { dynamicTool, jsonSchema, Tool } from "ai";
import {
    formatMcpToolResult,
    McpToolOutput,
    McpToolResult,
    shouldExposeMcpTool,
    toMcpToolName,
} from "./mcpConnectorUtils";

const logger = createLogger('ask-mcp-connectors');

const CONNECT_TIMEOUT_MS = 10_000;
const TOOL_CALL_TIMEOUT_MS = 120_000;

export type ConnectedMcpServer = {
    name: string;
    description?: string;
    toolCount: number;
};

export type McpConnectorTools = {
    tools: Record<string, Tool>;
    /** Servers that connected successfully and expose at least one tool. */
    servers: ConnectedMcpServer[];
    /** Closes all MCP client connections. Safe to call more than once. */
    close: () => Promise<void>;
};

export const getConfiguredMcpServers = async (): Promise<McpServer[]> => {
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        return (config.mcpServers ?? []).filter((server) => server.enabled !== false);
    } catch (error) {
        logger.error('Failed to load MCP server configuration', error);
        return [];
    }
}

const resolveHeaders = async (headers: McpServer['headers']): Promise<Record<string, string>> => {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers ?? {})) {
        resolved[key] = typeof value === 'string' ? value : await getTokenFromConfig(value);
    }
    return resolved;
}

const createTransport = (server: McpServer, headers: Record<string, string>): Transport => {
    const url = new URL(server.url);
    const requestInit: RequestInit = { headers };

    if (server.transport === 'sse') {
        return new SSEClientTransport(url, {
            requestInit,
            // The SSE stream is opened with a separate GET request; it needs the headers too.
            eventSourceInit: {
                fetch: (input, init) => fetch(input, {
                    ...init,
                    headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), ...headers },
                }),
            },
        });
    }

    return new StreamableHTTPClientTransport(url, { requestInit });
}

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timeout: NodeJS.Timeout;
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error(message)), ms);
        }),
    ]).finally(() => clearTimeout(timeout));
}

const connectServer = async (server: McpServer): Promise<{ client: Client, tools: Awaited<ReturnType<Client['listTools']>>['tools'] }> => {
    const headers = await resolveHeaders(server.headers);
    const client = new Client({ name: 'nexuscode-ask', version: '1.0.0' });

    try {
        await withTimeout(
            client.connect(createTransport(server, headers)),
            CONNECT_TIMEOUT_MS,
            `Timed out connecting after ${CONNECT_TIMEOUT_MS / 1000}s`,
        );

        const tools: Awaited<ReturnType<Client['listTools']>>['tools'] = [];
        let cursor: string | undefined;
        do {
            const page = await client.listTools(cursor ? { cursor } : undefined, { timeout: CONNECT_TIMEOUT_MS });
            tools.push(...page.tools);
            cursor = page.nextCursor;
        } while (cursor);

        return { client, tools };
    } catch (error) {
        await client.close().catch(() => { });
        throw error;
    }
}

/**
 * Connects to the configured MCP servers and exposes their tools as AI SDK tools.
 *
 * Servers that fail to connect are logged and skipped so that a broken server
 * does not prevent Ask from working. Callers must call `close()` when done.
 */
export const connectMcpServers = async (servers: McpServer[]): Promise<McpConnectorTools> => {
    const clients: Client[] = [];
    const tools: Record<string, Tool> = {};
    const connected: ConnectedMcpServer[] = [];

    const results = await Promise.allSettled(servers.map(connectServer));

    results.forEach((result, index) => {
        const server = servers[index];
        if (result.status === 'rejected') {
            logger.warn(`Skipping MCP server "${server.name}" (${server.url}): ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
            return;
        }

        const { client, tools: serverTools } = result.value;
        clients.push(client);

        let toolCount = 0;
        for (const mcpTool of serverTools) {
            if (!shouldExposeMcpTool(mcpTool.name, server)) {
                continue;
            }

            const name = toMcpToolName(server.name, mcpTool.name, new Set(Object.keys(tools)));

            tools[name] = dynamicTool({
                title: `${server.name} · ${mcpTool.title ?? mcpTool.name}`,
                description: `[MCP server "${server.name}"] ${mcpTool.description ?? ''}`.trim(),
                inputSchema: jsonSchema(mcpTool.inputSchema as Parameters<typeof jsonSchema>[0]),
                execute: async (input, { abortSignal }): Promise<McpToolOutput> => {
                    try {
                        const result = await client.callTool(
                            { name: mcpTool.name, arguments: (input ?? {}) as Record<string, unknown> },
                            undefined,
                            { signal: abortSignal, timeout: TOOL_CALL_TIMEOUT_MS },
                        );
                        return {
                            server: server.name,
                            tool: mcpTool.name,
                            ...formatMcpToolResult(result as McpToolResult),
                        };
                    } catch (error) {
                        logger.warn(`MCP tool ${server.name}/${mcpTool.name} failed`, error);
                        return {
                            server: server.name,
                            tool: mcpTool.name,
                            output: `Error calling tool: ${error instanceof Error ? error.message : String(error)}`,
                            isError: true,
                        };
                    }
                },
                toModelOutput: ({ output }) => ({
                    type: 'text',
                    value: (output as McpToolOutput).output,
                }),
            });
            toolCount++;
        }

        if (toolCount > 0) {
            connected.push({ name: server.name, description: server.description, toolCount });
        }
        logger.debug(`Connected to MCP server "${server.name}" with ${toolCount} tool(s).`);
    });

    let isClosed = false;
    return {
        tools,
        servers: connected,
        close: async () => {
            if (isClosed) {
                return;
            }
            isClosed = true;
            await Promise.allSettled(clients.map((client) => client.close()));
        },
    };
}
