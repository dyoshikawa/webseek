/**
 * Public programmatic API for webseek.
 *
 * This is the library entry point (`import ... from "webseek"`). The CLI and MCP
 * server are separate entry points; everything exported here is the stable,
 * documented surface for embedding web search into another program.
 */

// Core search
export { GEMINI_BACKENDS, PROVIDER_NAMES, runSearch } from "./lib/search.js";
export type { RunSearchParams } from "./lib/search.js";

// Result and provider types
export type {
  Citation,
  NormalizedSearchResult,
  ProviderName,
  SearchParams,
  SearchCost,
  SearchProvider,
  SearchResultItem,
  SearchUsage,
} from "./providers/provider.js";

// Cost estimation
export { estimateCost } from "./pricing/pricing.js";
export type { EstimateCostParams } from "./pricing/pricing.js";

// Environment configuration types
export type { Env, GeminiBackend } from "./config/env.js";

// Errors
export { errorExitCode, formatError, WebseekError } from "./utils/error.js";
export type { WebseekErrorCode, WebseekErrorOptions } from "./utils/error.js";

// MCP tool factory — embed the `web_search` tool into your own MCP server
export { createWebSearchTool, webSearchInputShape } from "./mcp/tools.js";
export type {
  CreateWebSearchToolParams,
  ToolResult,
  WebSearchArgs,
  WebSearchTool,
} from "./mcp/tools.js";
