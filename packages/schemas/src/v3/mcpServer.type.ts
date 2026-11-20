// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!

/**
 * A remote MCP (Model Context Protocol) server whose tools are made available to Ask Sourcebot.
 */
export interface McpServer {
  /**
   * Unique name of the server. Used to prefix its tool names (e.g. `jira__search_issues`) and in logs.
   */
  name: string;
  /**
   * The URL of the MCP server endpoint.
   */
  url: string;
  /**
   * The transport used to connect to the server. Use `sse` for servers that only support the legacy HTTP+SSE transport.
   */
  transport?: "streamable-http" | "sse";
  /**
   * Optional headers sent with every request to the server (e.g. `Authorization`). Values can be plain strings or tokens resolved from environment variables or secrets.
   */
  headers?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$".
     */
    [k: string]:
      | string
      | (
          | {
              /**
               * The name of the environment variable that contains the token.
               */
              env: string;
            }
          | {
              /**
               * The resource name of a Google Cloud secret. Must be in the format `projects/<project-id>/secrets/<secret-name>/versions/<version-id>`. See https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets
               */
              googleCloudSecret: string;
            }
        );
  };
  /**
   * Optional description of what the server provides. Shown to the agent to help it decide when to use the server's tools.
   */
  description?: string;
  /**
   * If set, only these tools (by their original name on the server) are exposed to the agent.
   */
  includeTools?: string[];
  /**
   * Tools (by their original name on the server) that are never exposed to the agent.
   */
  excludeTools?: string[];
  /**
   * Set to false to temporarily disable the server without removing it.
   */
  enabled?: boolean;
}
