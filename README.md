# websearch

Web search using the API keys of multiple providers behind a single, unified
interface. Bring whichever provider key you already have and search the web —
either from your terminal (**CLI mode**) or from an MCP client such as an editor
or agent (**MCP server mode**). Both modes share the same core search logic.

## Providers

`websearch` normalizes two fundamentally different kinds of "web search":

| Provider | Kind                                        | Output                           |
| -------- | ------------------------------------------- | -------------------------------- |
| `google` | SERP-style (Google Custom Search)           | a ranked list of links           |
| `openai` | LLM-grounded (Responses API `web_search`)   | a synthesized answer + citations |
| `gemini` | LLM-grounded (Grounding with Google Search) | a synthesized answer + citations |

The Gemini provider supports two backends that share the same request/response
shape: the **Gemini Developer API** (`gemini-api`, default) and **Vertex AI
express mode** (`vertex-express`).

## Install / build

```bash
pnpm install
pnpm build      # emits dist/, exposes the `websearch` bin
```

During development you can run without building via `pnpm dev -- <args>` (runs
the TypeScript source through `tsx`).

## CLI mode

```bash
websearch search <query...> --provider <openai|google|gemini> [options]
```

Options for `search`:

| Flag                    | Description                                 |
| ----------------------- | ------------------------------------------- |
| `-p, --provider <name>` | `openai` \| `google` \| `gemini` (required) |
| `-n, --max-results <n>` | Desired number of results (SERP providers)  |
| `-m, --model <name>`    | Model override (`openai`, `gemini`)         |
| `--gemini-backend <b>`  | `gemini-api` (default) \| `vertex-express`  |
| `--json`                | Emit normalized JSON instead of text        |
| `--raw`                 | Include the provider's raw response         |

Examples:

```bash
websearch search "best static site generators 2026" -p google -n 5
websearch search "summarize the latest TypeScript release" -p openai
websearch search "who won euro 2024" -p gemini --gemini-backend vertex-express --json
```

## MCP server mode

Start a [Model Context Protocol](https://modelcontextprotocol.io) server over
stdio that exposes a single `web_search` tool:

```bash
websearch mcp
```

Register it with an MCP client, e.g.:

```jsonc
{
  "mcpServers": {
    "websearch": {
      "command": "websearch",
      "args": ["mcp"],
      "env": { "GEMINI_API_KEY": "..." },
    },
  },
}
```

The `web_search` tool accepts `{ query, provider, maxResults?, model?, geminiBackend?, includeRaw? }`
and returns the normalized result as JSON.

## Authentication

API keys are read from **environment variables only** (never from flags), so
they don't leak into shell history or process listings.

| Provider                  | Environment variables                                             |
| ------------------------- | ----------------------------------------------------------------- |
| `openai`                  | `OPENAI_API_KEY`                                                  |
| `google`                  | `GOOGLE_API_KEY`, `GOOGLE_CSE_CX` (Programmable Search Engine ID) |
| `gemini` (gemini-api)     | `GEMINI_API_KEY` (falls back to `GOOGLE_API_KEY`)                 |
| `gemini` (vertex-express) | `VERTEX_API_KEY`                                                  |

## Caveats

- **Google Custom Search is closed to new customers.** Existing customers must
  migrate before 2027-01-01. Treat this provider as the most at-risk.
- **Google Custom Search returns at most 100 results** (10 per request); large
  `--max-results` values paginate and consume more quota.
- **Gemini grounding requires displaying Google Search Suggestions** per its
  terms. As a CLI we surface the queries the model ran on the `Searches:` line;
  the source URIs Gemini returns are temporary redirect links.

## Architecture

```
src/
  cli/        commander program: `search` and `mcp` commands
  mcp/        MCP server + the web_search tool
  lib/        runSearch — the shared core called by both CLI and MCP
  providers/  per-provider implementations (openai, google-cse, gemini)
  config/     credential + base-URL resolution from env
  output/     text / JSON formatting
  utils/      logger, error formatter
  e2e/        end-to-end tests (spawn the CLI / drive the MCP server)
```

## Development

```bash
pnpm cicheck      # format check, lint, typecheck, unit tests, spelling, secrets
pnpm test:e2e     # end-to-end tests (CLI subprocess + MCP stdio client)
```
