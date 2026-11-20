<div align="center">
  <h1>NexusCode</h1>
  <p>Self-hosted code search, navigation and AI Q&amp;A across all of your repositories.</p>
</div>

NexusCode is a self-hosted tool that helps you understand your codebase. It is
based on [Sourcebot](https://github.com/sourcebot-dev/sourcebot) (v4) and
extends its Ask feature.

## Features

- **Code search** – fast regex and symbol search across all repos and branches
  on any code host, with repo/language filters and boolean logic.
- **File explorer** – browse every file with syntax highlighting, a file tree,
  blame, history and diffs.
- **Code navigation** – go to definition and find references across repos
  (enterprise feature inherited from Sourcebot, see `ee/LICENSE`).
- **Ask** – ask questions about your code in natural language and get answers
  with inline citations. On top of the upstream feature, NexusCode adds:
  - Mermaid diagram rendering and prompt caching
  - text file and image attachments
  - skills: reusable instructions, invoked with `/name` or automatically
  - tools from remote MCP servers (`mcpServers` in `config.json`)
  - language models configured from **Settings → Models**, without editing `config.json`
- **Accounts** – change your password in **Settings → Account**; owners can
  reset a member's password from **Settings → Members**.

## Running locally

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the toolchain (Node.js, Go,
universal-ctags, Docker) and the development setup. In short:

```sh
make                                            # build zoekt, install dependencies
docker compose -f docker-compose-dev.yml up -d  # Postgres + Redis
yarn dev:prisma:migrate:dev                     # set up the database
yarn dev                                        # web on http://localhost:3000
```

Repositories to index and language models are configured in `config.json`
(language models can also be added in the settings UI). Configuration options
are documented in the upstream docs:

- [Config file](https://docs.sourcebot.dev/docs/configuration/config-file)
- [Language model providers](https://docs.sourcebot.dev/docs/configuration/language-model-providers)
- [Environment variables](https://docs.sourcebot.dev/docs/configuration/environment-variables)

Internal identifiers are unchanged from upstream: packages are named
`@sourcebot/*`, environment variables use the `SOURCEBOT_` prefix and API keys
are sent in the `X-Sourcebot-Api-Key` header.

## Telemetry

Telemetry is **disabled by default**. Set `SOURCEBOT_TELEMETRY_DISABLED=false`
to opt in to the anonymous usage events inherited from upstream.

## License

NexusCode is a modified version of Sourcebot, Copyright (c) Taqla Inc.
Code outside `ee/` is available under the Functional Source License 1.1
(ALv2 future license) in [`LICENSE.md`](./LICENSE.md); code in `ee/` is
covered by [`ee/LICENSE`](./ee/LICENSE).
