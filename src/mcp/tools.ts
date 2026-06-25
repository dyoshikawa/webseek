/**
 * The `web_search` MCP tool. It is the MCP-mode counterpart to the CLI `search`
 * command: both validate their inputs and call the same `runSearch` core.
 */

import { z } from "zod";

import type { Env } from "../config/env.js";
import { GEMINI_BACKENDS, PROVIDER_NAMES, runSearch } from "../lib/search.js";
import { formatError } from "../utils/error.js";

export const webSearchInputShape = {
  query: z.string().min(1).describe("The search query."),
  provider: z.enum(PROVIDER_NAMES).describe("Which provider to search with."),
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Desired number of results (SERP providers; best-effort otherwise)."),
  model: z.string().optional().describe("Model override for LLM-backed providers."),
  geminiBackend: z
    .enum(GEMINI_BACKENDS)
    .optional()
    .describe("Gemini backend: gemini-api (default) or vertex-express."),
  includeRaw: z.boolean().optional().describe("Include the provider's raw response."),
};

const webSearchArgsSchema = z.object(webSearchInputShape);
export type WebSearchArgs = z.infer<typeof webSearchArgsSchema>;

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  // The MCP SDK's CallToolResult carries an open-ended index signature.
  [key: string]: unknown;
}

export interface CreateWebSearchToolParams {
  /** Injectable for tests; defaults to the process environment. */
  env?: Env;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface WebSearchTool {
  name: string;
  config: {
    title: string;
    description: string;
    inputSchema: typeof webSearchInputShape;
  };
  handler: (args: WebSearchArgs) => Promise<ToolResult>;
}

export function createWebSearchTool(params: CreateWebSearchToolParams = {}): WebSearchTool {
  return {
    name: "web_search",
    config: {
      title: "Web Search",
      description:
        "Search the web using a provider's API key (OpenAI, Google Custom Search, or Gemini). " +
        "Returns a normalized JSON result with SERP results and/or a grounded answer with citations.",
      inputSchema: webSearchInputShape,
    },
    handler: async (args: WebSearchArgs): Promise<ToolResult> => {
      try {
        const result = await runSearch({
          provider: args.provider,
          query: args.query,
          maxResults: args.maxResults,
          model: args.model,
          geminiBackend: args.geminiBackend,
          includeRaw: args.includeRaw,
          env: params.env,
          fetchImpl: params.fetchImpl,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    },
  };
}
