/**
 * Resolves provider credentials and configuration from environment variables.
 *
 * API keys are read from the environment only (never from CLI flags/args) so
 * they don't leak into shell history or process listings.
 *
 * Each provider's base URL can be overridden via an environment variable. This
 * keeps the defaults pointed at the real services while letting tests (and
 * proxies) redirect traffic to a local endpoint.
 */

import { WebsearchError } from "../utils/error.js";

export interface Env {
  [key: string]: string | undefined;
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";
const DEFAULT_GOOGLE_BASE_URL = "https://www.googleapis.com";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_VERTEX_BASE_URL = "https://aiplatform.googleapis.com";

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export interface ResolveOpenAIConfigParams {
  env?: Env;
}

export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
}

export function resolveOpenAIConfig(params: ResolveOpenAIConfigParams = {}): OpenAIConfig {
  const env = params.env ?? process.env;
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new WebsearchError({
      code: "missing_config",
      message: "OPENAI_API_KEY is not set. Export it to use the openai provider.",
    });
  }
  return {
    apiKey,
    baseUrl: stripTrailingSlash(env.WEBSEARCH_OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL),
  };
}

export interface ResolveGoogleCseConfigParams {
  env?: Env;
}

export interface GoogleCseConfig {
  apiKey: string;
  cx: string;
  baseUrl: string;
}

export function resolveGoogleCseConfig(params: ResolveGoogleCseConfigParams = {}): GoogleCseConfig {
  const env = params.env ?? process.env;
  const apiKey = env.GOOGLE_API_KEY;
  const cx = env.GOOGLE_CSE_CX ?? env.GOOGLE_CSE_ID;
  if (!apiKey) {
    throw new WebsearchError({
      code: "missing_config",
      message: "GOOGLE_API_KEY is not set. Export it to use the google provider.",
    });
  }
  if (!cx) {
    throw new WebsearchError({
      code: "missing_config",
      message:
        "GOOGLE_CSE_CX is not set. Export your Programmable Search Engine ID to use the google provider.",
    });
  }
  return {
    apiKey,
    cx,
    baseUrl: stripTrailingSlash(env.WEBSEARCH_GOOGLE_BASE_URL ?? DEFAULT_GOOGLE_BASE_URL),
  };
}

export type GeminiBackend = "gemini-api" | "vertex-express";

export interface ResolveGeminiConfigParams {
  env?: Env;
  backend: GeminiBackend;
}

export interface GeminiConfig {
  apiKey: string;
  backend: GeminiBackend;
  baseUrl: string;
}

export function resolveGeminiConfig(params: ResolveGeminiConfigParams): GeminiConfig {
  const env = params.env ?? process.env;
  const { backend } = params;

  if (backend === "vertex-express") {
    const apiKey = env.VERTEX_API_KEY;
    if (!apiKey) {
      throw new WebsearchError({
        code: "missing_config",
        message:
          "VERTEX_API_KEY is not set. Export it to use the gemini provider with the vertex-express backend.",
      });
    }
    return {
      apiKey,
      backend,
      baseUrl: stripTrailingSlash(env.WEBSEARCH_VERTEX_BASE_URL ?? DEFAULT_VERTEX_BASE_URL),
    };
  }

  const apiKey = env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new WebsearchError({
      code: "missing_config",
      message: "GEMINI_API_KEY is not set. Export it to use the gemini provider.",
    });
  }
  return {
    apiKey,
    backend,
    baseUrl: stripTrailingSlash(env.WEBSEARCH_GEMINI_BASE_URL ?? DEFAULT_GEMINI_BASE_URL),
  };
}
