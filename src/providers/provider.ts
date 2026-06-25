/**
 * Shared types and the provider interface for the websearch CLI.
 *
 * Web search providers fall into two categories that this schema normalizes:
 * - SERP-style providers (e.g. Google Custom Search) return a ranked list of
 *   links in `results`.
 * - LLM-grounded providers (e.g. OpenAI web search, Gemini grounding) return a
 *   synthesized `answer` plus `citations` and the underlying `searchQueries`.
 */

export type ProviderName = "openai" | "google" | "gemini";

/** A single SERP-style result (one link). */
export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  displayLink?: string;
}

/** A single source citation backing a grounded answer. */
export interface Citation {
  url: string;
  title?: string;
  /** Character offsets into `answer` that this citation supports, if known. */
  startIndex?: number;
  endIndex?: number;
}

/** The normalized result shape returned by every provider. */
export interface NormalizedSearchResult {
  provider: ProviderName;
  query: string;
  /** SERP-style results (empty for grounded providers). */
  results: SearchResultItem[];
  /** Grounded answer text, if the provider synthesizes one. */
  answer?: string;
  /** Sources backing the answer (grounded providers). */
  citations: Citation[];
  /** Queries the provider actually ran (grounded providers). */
  searchQueries: string[];
  /** The provider's raw response, included only when requested. */
  raw?: unknown;
}

/** Options shared by every provider's `search` call. */
export interface SearchParams {
  query: string;
  /** Desired number of results; best-effort for grounded providers. */
  maxResults?: number;
  /** Model override for LLM-backed providers. */
  model?: string;
  /** Include the provider's raw response in the result. */
  includeRaw?: boolean;
  /** Injectable fetch for testing; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** A web search provider. Implementations are stateless given their config. */
export interface SearchProvider {
  readonly name: ProviderName;
  search(params: SearchParams): Promise<NormalizedSearchResult>;
}
