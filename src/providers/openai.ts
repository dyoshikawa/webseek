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
import { WebseekError } from "../utils/error.js";
import type { Citation, NormalizedSearchResult, SearchParams, SearchProvider } from "./provider.js";

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

const responseSchema = z.looseObject({
  output: z.array(outputItemSchema).optional(),
  output_text: z.string().optional(),
  error: z.looseObject({ message: z.string().optional() }).optional(),
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

      const { answer, citations, searchQueries } = extract(parsed.data);

      return {
        provider: "openai",
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
  const textParts: string[] = [];
  const citations: Citation[] = [];
  const searchQueries: string[] = [];

  for (const item of data.output ?? []) {
    if (item.type === "web_search_call" && item.action?.query) {
      searchQueries.push(item.action.query);
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
  return { answer, citations, searchQueries };
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
