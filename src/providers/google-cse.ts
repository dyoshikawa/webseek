/**
 * Google Custom Search (Programmable Search Engine) JSON API provider.
 *
 * This is a SERP-style provider: it returns a ranked list of links.
 *
 * NOTE: The Custom Search JSON API is closed to new customers; existing
 * customers must migrate before 2027-01-01. See the README for details.
 *
 * Docs: https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
 */

import { z } from "zod";

import type { GoogleCseConfig } from "../config/env.js";
import { WebseekError } from "../utils/error.js";
import type { NormalizedSearchResult, SearchParams, SearchProvider } from "./provider.js";

const PATH = "/customsearch/v1";

/** Max results the API returns per request, and the hard cap on total results. */
const MAX_PER_REQUEST = 10;
const MAX_TOTAL_RESULTS = 100;

// Loose schema: the API is external and evolving, so only validate what we use.
const itemSchema = z.looseObject({
  title: z.string().optional(),
  link: z.string().optional(),
  snippet: z.string().optional(),
  displayLink: z.string().optional(),
});

const responseSchema = z.looseObject({
  items: z.array(itemSchema).optional(),
  error: z
    .looseObject({
      code: z.number().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export interface GoogleCseProviderParams {
  config: GoogleCseConfig;
}

export function createGoogleCseProvider(params: GoogleCseProviderParams): SearchProvider {
  const { config } = params;

  return {
    name: "google",
    async search(searchParams: SearchParams): Promise<NormalizedSearchResult> {
      const fetchImpl = searchParams.fetchImpl ?? fetch;
      const desired = clampDesired(searchParams.maxResults ?? MAX_PER_REQUEST);

      const items: z.infer<typeof itemSchema>[] = [];
      let lastRaw: unknown;

      // Paginate in pages of 10 until we have enough or run out of results.
      for (
        let start = 1;
        start <= MAX_TOTAL_RESULTS && items.length < desired;
        start += MAX_PER_REQUEST
      ) {
        const num = Math.min(MAX_PER_REQUEST, desired - items.length);
        const url = buildUrl({ config, query: searchParams.query, start, num });

        const response = await fetchImpl(url);
        const body = await response.json().catch(() => undefined);
        lastRaw = body;

        const parsed = responseSchema.safeParse(body);
        if (!response.ok || !parsed.success) {
          throw toError({ status: response.status, body: parsed.success ? parsed.data : body });
        }

        const page = parsed.data.items ?? [];
        items.push(...page);
        if (page.length < num) {
          break; // No more results available.
        }
      }

      return {
        provider: "google",
        query: searchParams.query,
        results: items.slice(0, desired).map((item) => ({
          title: item.title ?? "",
          url: item.link ?? "",
          snippet: item.snippet ?? "",
          displayLink: item.displayLink,
        })),
        citations: [],
        searchQueries: [searchParams.query],
        raw: searchParams.includeRaw ? lastRaw : undefined,
      };
    },
  };
}

function clampDesired(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return MAX_PER_REQUEST;
  }
  return Math.min(Math.floor(value), MAX_TOTAL_RESULTS);
}

interface BuildUrlParams {
  config: GoogleCseConfig;
  query: string;
  start: number;
  num: number;
}

function buildUrl(params: BuildUrlParams): string {
  const url = new URL(`${params.config.baseUrl}${PATH}`);
  url.searchParams.set("key", params.config.apiKey);
  url.searchParams.set("cx", params.config.cx);
  url.searchParams.set("q", params.query);
  url.searchParams.set("num", String(params.num));
  url.searchParams.set("start", String(params.start));
  return url.toString();
}

interface ToErrorParams {
  status: number;
  body: unknown;
}

function toError(params: ToErrorParams): WebseekError {
  const message =
    extractMessage(params.body) ?? `Google Custom Search request failed (HTTP ${params.status}).`;
  if (params.status === 401 || params.status === 403) {
    return new WebseekError({ code: "auth_failed", message });
  }
  if (params.status === 429) {
    return new WebseekError({ code: "rate_limited", message });
  }
  return new WebseekError({ code: "provider_error", message });
}

function extractMessage(body: unknown): string | undefined {
  const parsed = responseSchema.safeParse(body);
  return parsed.success ? parsed.data.error?.message : undefined;
}
