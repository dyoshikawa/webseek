/**
 * Gemini web search provider via "Grounding with Google Search".
 *
 * Grounded provider: the model runs searches and returns an answer plus
 * grounding metadata (sources + the queries it ran).
 *
 * Two backends share the same `generateContent` request/response shape; only
 * the host, auth style, and the search-tool field name differ:
 * - `gemini-api`     → generativelanguage.googleapis.com, `x-goog-api-key`,
 *                      tool field `google_search` (snake_case).
 * - `vertex-express` → aiplatform.googleapis.com, `?key=`, tool field
 *                      `googleSearch` (camelCase).
 *
 * We deliberately use the classic `generateContent` endpoint (response carries
 * `groundingMetadata`) rather than the newer Interactions API.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/google-search
 *       https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search
 */

import { z } from "zod";

import type { GeminiBackend, GeminiConfig } from "../config/env.js";
import { WebseekError } from "../utils/error.js";
import type { Citation, NormalizedSearchResult, SearchParams, SearchProvider } from "./provider.js";

const DEFAULT_MODEL = "gemini-2.5-flash";

interface BuildRequestParams {
  model: string;
  apiKey: string;
  baseUrl: string;
}

interface BackendWire {
  searchToolField: "google_search" | "googleSearch";
  buildRequest: (params: BuildRequestParams) => {
    url: string;
    headers: Record<string, string>;
  };
}

const BACKENDS: Record<GeminiBackend, BackendWire> = {
  "gemini-api": {
    searchToolField: "google_search",
    buildRequest: ({ model, apiKey, baseUrl }) => ({
      url: `${baseUrl}/v1beta/models/${model}:generateContent`,
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    }),
  },
  "vertex-express": {
    searchToolField: "googleSearch",
    buildRequest: ({ model, apiKey, baseUrl }) => ({
      url: `${baseUrl}/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      headers: { "content-type": "application/json" },
    }),
  },
};

const webSchema = z.looseObject({ uri: z.string().optional(), title: z.string().optional() });

const groundingMetadataSchema = z.looseObject({
  webSearchQueries: z.array(z.string()).optional(),
  groundingChunks: z.array(z.looseObject({ web: webSchema.optional() })).optional(),
});

const candidateSchema = z.looseObject({
  content: z
    .looseObject({ parts: z.array(z.looseObject({ text: z.string().optional() })).optional() })
    .optional(),
  groundingMetadata: groundingMetadataSchema.optional(),
});

const responseSchema = z.looseObject({
  candidates: z.array(candidateSchema).optional(),
  error: z.looseObject({ message: z.string().optional() }).optional(),
});

export interface GeminiProviderParams {
  config: GeminiConfig;
}

export function createGeminiProvider(params: GeminiProviderParams): SearchProvider {
  const { config } = params;
  const wire = BACKENDS[config.backend];

  return {
    name: "gemini",
    async search(searchParams: SearchParams): Promise<NormalizedSearchResult> {
      const fetchImpl = searchParams.fetchImpl ?? fetch;
      const model = searchParams.model ?? DEFAULT_MODEL;
      const { url, headers } = wire.buildRequest({
        model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      });

      const response = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contents: [{ parts: [{ text: searchParams.query }] }],
          tools: [{ [wire.searchToolField]: {} }],
        }),
      });

      const body = await response.json().catch(() => undefined);
      const parsed = responseSchema.safeParse(body);
      if (!response.ok || !parsed.success) {
        throw toError({ status: response.status, body });
      }

      const { answer, citations, searchQueries } = extract(parsed.data);

      return {
        provider: "gemini",
        query: searchParams.query,
        results: [],
        answer,
        citations,
        searchQueries,
        raw: searchParams.includeRaw ? body : undefined,
      };
    },
  };
}

interface Extracted {
  answer: string;
  citations: Citation[];
  searchQueries: string[];
}

function extract(data: z.infer<typeof responseSchema>): Extracted {
  const candidate = data.candidates?.[0];
  const answer = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("");

  const metadata = candidate?.groundingMetadata;
  const citations: Citation[] = (metadata?.groundingChunks ?? [])
    .map((chunk) => chunk.web)
    .filter(
      (web): web is { uri?: string; title?: string } => web !== undefined && web.uri !== undefined,
    )
    .map((web) => ({ url: web.uri as string, title: web.title }));

  return {
    answer,
    citations,
    searchQueries: metadata?.webSearchQueries ?? [],
  };
}

interface ToErrorParams {
  status: number;
  body: unknown;
}

function toError(params: ToErrorParams): WebseekError {
  const parsed = responseSchema.safeParse(params.body);
  const message =
    (parsed.success ? parsed.data.error?.message : undefined) ??
    `Gemini grounding request failed (HTTP ${params.status}).`;
  if (params.status === 401 || params.status === 403) {
    return new WebseekError({ code: "auth_failed", message });
  }
  if (params.status === 429) {
    return new WebseekError({ code: "rate_limited", message });
  }
  return new WebseekError({ code: "provider_error", message });
}
