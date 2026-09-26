/**
 * OpenAI web search provider (Responses API `web_search` tool).
 *
 * This is a grounded provider: the model runs searches and returns a
 * synthesized answer plus `url_citation` annotations.
 *
 * Docs: https://developers.openai.com/api/docs/guides/tools-web-search
 */

import { z } from "zod";

import type { OpenAIConfig } from "../config/env.js";
import { estimateCost } from "../pricing/pricing.js";
import { WebseekError } from "../utils/error.js";
import type {
  Citation,
  NormalizedSearchResult,
  SearchParams,
  SearchProvider,
  SearchUsage,
} from "./provider.js";

const PATH = "/v1/responses";
const DEFAULT_MODEL = "gpt-5.5";

const annotationSchema = z.looseObject({
  type: z.string().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  start_index: z.number().optional(),
  end_index: z.number().optional(),
});

const contentSchema = z.looseObject({
  type: z.string().optional(),
  text: z.string().optional(),
  annotations: z.array(annotationSchema).optional(),
});

const outputItemSchema = z.looseObject({
  type: z.string().optional(),
  content: z.array(contentSchema).optional(),
  action: z.looseObject({ query: z.string().optional() }).optional(),
});

const usageSchema = z.looseObject({
  input_tokens: z.number().optional(),
  input_tokens_details: z.looseObject({ cached_tokens: z.number().optional() }).nullish(),
  output_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
});

const responseSchema = z.looseObject({
  output: z.array(outputItemSchema).optional(),
  output_text: z.string().optional(),
  model: z.string().optional(),
  usage: usageSchema.nullish(),
  error: z.looseObject({ message: z.string().optional() }).nullish(),
});

export interface OpenAIProviderParams {
  config: OpenAIConfig;
}

export function createOpenAIProvider(params: OpenAIProviderParams): SearchProvider {
  const { config } = params;

  return {
    name: "openai",
    async search(searchParams: SearchParams): Promise<NormalizedSearchResult> {
      const fetchImpl = searchParams.fetchImpl ?? fetch;
      const model = searchParams.model ?? DEFAULT_MODEL;

      const response = await fetchImpl(`${config.baseUrl}${PATH}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          tools: [{ type: "web_search" }],
          input: searchParams.query,
        }),
      });

      const body = await response.json().catch(() => undefined);
      const parsed = responseSchema.safeParse(body);
      if (!response.ok || !parsed.success) {
        throw toError({ status: response.status, body });
      }

      const { answer, citations, searchQueries, searchCalls } = extract(parsed.data);
      const servedModel = parsed.data.model ?? model;
      const usage = toUsage({ usage: parsed.data.usage, searchCalls });

      return {
        provider: "openai",
        query: searchParams.query,
        results: [],
        answer,
        citations,
        searchQueries,
        model: servedModel,
        usage,
        cost: estimateCost({ provider: "openai", model: servedModel, fallbackModel: model, usage }),
        raw: searchParams.includeRaw ? body : undefined,
      };
    },
  };
}

interface Extracted {
  answer: string;
  citations: Citation[];
  searchQueries: string[];
  searchCalls: number;
}

function extract(data: z.infer<typeof responseSchema>): Extracted {
  const textParts: string[] = [];
  const citations: Citation[] = [];
  const searchQueries: string[] = [];
  let searchCalls = 0;

  for (const item of data.output ?? []) {
    // Every web_search_call item is one billed tool call, whatever its action
    // (search, open_page, find_in_page).
    if (item.type === "web_search_call") {
      searchCalls += 1;
      if (item.action?.query) {
        searchQueries.push(item.action.query);
      }
    }
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        textParts.push(content.text);
      }
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation" && annotation.url) {
          citations.push({
            url: annotation.url,
            title: annotation.title,
            startIndex: annotation.start_index,
            endIndex: annotation.end_index,
          });
        }
      }
    }
  }

  const answer = textParts.length > 0 ? textParts.join("") : (data.output_text ?? "");
  return { answer, citations, searchQueries, searchCalls };
}

interface ToUsageParams {
  usage: z.infer<typeof usageSchema> | null | undefined;
  searchCalls: number;
}

function toUsage(params: ToUsageParams): SearchUsage {
  const { usage } = params;
  return {
    inputTokens: usage?.input_tokens,
    cachedInputTokens: usage?.input_tokens_details?.cached_tokens,
    outputTokens: usage?.output_tokens,
    totalTokens: usage?.total_tokens,
    searchCalls: params.searchCalls,
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
    `OpenAI web search request failed (HTTP ${params.status}).`;
  if (params.status === 401) {
    return new WebseekError({ code: "auth_failed", message });
  }
  if (params.status === 429) {
    return new WebseekError({ code: "rate_limited", message });
  }
  return new WebseekError({ code: "provider_error", message });
}
