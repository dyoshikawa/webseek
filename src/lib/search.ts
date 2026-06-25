/**
 * Resolves a provider by name, wires its config from the environment, and runs
 * the search. This is the seam between CLI argument parsing and the providers.
 */

import type { Env, GeminiBackend } from "../config/env.js";
import { resolveGeminiConfig, resolveGoogleCseConfig, resolveOpenAIConfig } from "../config/env.js";
import { createGeminiProvider } from "../providers/gemini.js";
import { createGoogleCseProvider } from "../providers/google-cse.js";
import { createOpenAIProvider } from "../providers/openai.js";
import type { NormalizedSearchResult, ProviderName } from "../providers/provider.js";
import { WebsearchError } from "../utils/error.js";

export const PROVIDER_NAMES = ["openai", "google", "gemini"] as const;
export const GEMINI_BACKENDS = ["gemini-api", "vertex-express"] as const;

export interface RunSearchParams {
  provider: ProviderName;
  query: string;
  maxResults?: number;
  model?: string;
  includeRaw?: boolean;
  geminiBackend?: GeminiBackend;
  env?: Env;
  fetchImpl?: typeof fetch;
}

/** Validate an arbitrary string as a provider name, or throw a usage error. */
export function coerceProvider(value: unknown): ProviderName {
  if (typeof value === "string" && (PROVIDER_NAMES as readonly string[]).includes(value)) {
    return value as ProviderName;
  }
  throw new WebsearchError({
    code: "invalid_usage",
    message: `Invalid provider. Choose one of: ${PROVIDER_NAMES.join(", ")}.`,
  });
}

/** Validate an arbitrary string as a Gemini backend, or throw a usage error. */
export function coerceGeminiBackend(value: unknown): GeminiBackend {
  if (typeof value === "string" && (GEMINI_BACKENDS as readonly string[]).includes(value)) {
    return value as GeminiBackend;
  }
  throw new WebsearchError({
    code: "invalid_usage",
    message: `Invalid gemini backend. Choose one of: ${GEMINI_BACKENDS.join(", ")}.`,
  });
}

/** Validate a max-results value as a positive integer, or throw a usage error. */
export function coerceMaxResults(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new WebsearchError({
      code: "invalid_usage",
      message: "max-results must be a positive integer.",
    });
  }
  return parsed;
}

export function runSearch(params: RunSearchParams): Promise<NormalizedSearchResult> {
  const provider = resolveProvider(params);
  return provider.search({
    query: params.query,
    maxResults: params.maxResults,
    model: params.model,
    includeRaw: params.includeRaw,
    fetchImpl: params.fetchImpl,
  });
}

function resolveProvider(params: RunSearchParams) {
  switch (params.provider) {
    case "openai":
      return createOpenAIProvider({ config: resolveOpenAIConfig({ env: params.env }) });
    case "google":
      return createGoogleCseProvider({ config: resolveGoogleCseConfig({ env: params.env }) });
    case "gemini":
      return createGeminiProvider({
        config: resolveGeminiConfig({
          env: params.env,
          backend: params.geminiBackend ?? "gemini-api",
        }),
      });
    default:
      throw new WebsearchError({
        code: "invalid_usage",
        message: `Unknown provider: ${String(params.provider)}`,
      });
  }
}
