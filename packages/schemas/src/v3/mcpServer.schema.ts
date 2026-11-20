// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!
const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "McpServer",
  "description": "A remote MCP (Model Context Protocol) server whose tools are made available to Ask Sourcebot.",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Unique name of the server. Used to prefix its tool names (e.g. `jira__search_issues`) and in logs.",
      "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$",
      "examples": [
        "jira",
        "docs"
      ]
    },
    "url": {
      "type": "string",
      "format": "url",
      "pattern": "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$",
      "description": "The URL of the MCP server endpoint.",
      "examples": [
        "https://mcp.example.com/mcp"
      ]
    },
    "transport": {
      "type": "string",
      "enum": [
        "streamable-http",
        "sse"
      ],
      "default": "streamable-http",
      "description": "The transport used to connect to the server. Use `sse` for servers that only support the legacy HTTP+SSE transport."
    },
    "headers": {
      "type": "object",
      "description": "Optional headers sent with every request to the server (e.g. `Authorization`). Values can be plain strings or tokens resolved from environment variables or secrets.",
      "patternProperties": {
        "^[!#$%&'*+\\-.^_`|~0-9A-Za-z]+$": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "env": {
                      "type": "string",
                      "description": "The name of the environment variable that contains the token."
                    }
                  },
                  "required": [
                    "env"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "googleCloudSecret": {
                      "type": "string",
                      "description": "The resource name of a Google Cloud secret. Must be in the format `projects/<project-id>/secrets/<secret-name>/versions/<version-id>`. See https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets"
                    }
                  },
                  "required": [
                    "googleCloudSecret"
                  ],
                  "additionalProperties": false
                }
              ]
            }
          ]
        }
      },
      "additionalProperties": false
    },
    "description": {
      "type": "string",
      "description": "Optional description of what the server provides. Shown to the agent to help it decide when to use the server's tools."
    },
    "includeTools": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "If set, only these tools (by their original name on the server) are exposed to the agent."
    },
    "excludeTools": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Tools (by their original name on the server) that are never exposed to the agent."
    },
    "enabled": {
      "type": "boolean",
      "default": true,
      "description": "Set to false to temporarily disable the server without removing it."
    }
  },
  "required": [
    "name",
    "url"
  ],
  "additionalProperties": false
} as const;
export { schema as mcpServerSchema };