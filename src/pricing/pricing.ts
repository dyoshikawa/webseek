/**
 * List-price cost estimation for a search, in USD.
 *
 * Prices are the providers' published pay-as-you-go rates (checked 2026-09-25)
 * and ignore free allowances (Google Custom Search's 100 queries/day, Gemini's
 * free grounded requests), batch/flex discounts, and long-context tiers — a
 * search prompt never gets near 200k tokens. Treat the result as an estimate.
 *
 * Docs: https://developers.openai.com/api/docs/pricing
 *       https://ai.google.dev/gemini-api/docs/pricing
 *       https://developers.google.com/custom-search/v1/overview#pricing
 */

import type { ProviderName, SearchCost, SearchUsage } from "../providers/provider.js";

/** USD per 1M tokens. */
interface TokenRates {
  input: number;
  cachedInput: number;
  output: number;
}

interface ModelPrice {
  rates: TokenRates;
  /** Rates that replace `rates` from this date on (UTC, `YYYY-MM-DD`). */
  next?: { from: string; rates: TokenRates };
  /** USD per 1k billed search calls. */
  searchPer1k: number;
  /** Bill one search per grounded prompt, however many queries the model ran. */
  searchPerPrompt?: boolean;
}

/** OpenAI's `web_search` tool: $10 per 1k calls; search content tokens bill at model rates. */
const OPENAI_SEARCH_PER_1K = 10;

const OPENAI_PRICES: Record<string, ModelPrice> = {
  "gpt-5.5": openai({ input: 5, cachedInput: 0.5, output: 30 }),
  "gpt-5.4": openai({ input: 2.5, cachedInput: 0.25, output: 15 }),
  "gpt-5": openai({ input: 1.25, cachedInput: 0.125, output: 10 }),
  "gpt-5-mini": openai({ input: 0.25, cachedInput: 0.025, output: 2 }),
  "gpt-5-nano": openai({ input: 0.05, cachedInput: 0.005, output: 0.4 }),
  "gpt-4.1": openai({ input: 2, cachedInput: 0.5, output: 8 }),
  "gpt-4o": openai({ input: 2.5, cachedInput: 1.25, output: 10 }),
  "gpt-4o-mini": openai({ input: 0.15, cachedInput: 0.075, output: 0.6 }),
};

/**
 * Gemini 3.x: "$14 per 1,000 requests", read as one charge per search query the
 * model ran (each `webSearchQueries` entry), not per prompt.
 */
const GEMINI_3_SEARCH_PER_1K = 14;
/** Gemini 2.5 bills each grounded prompt, however many queries it ran ($35 per 1k). */
const GEMINI_2_5_SEARCH_PER_1K = 35;

const GEMINI_3_FLASH: ModelPrice = {
  rates: { input: 0.75, cachedInput: 0.075, output: 3.75 },
  next: { from: "2027-01-01", rates: { input: 1.5, cachedInput: 0.15, output: 7.5 } },
  searchPer1k: GEMINI_3_SEARCH_PER_1K,
};

const GEMINI_PRICES: Record<string, ModelPrice> = {
  "gemini-3.8-flash": GEMINI_3_FLASH,
  "gemini-3.7-flash": GEMINI_3_FLASH,
  "gemini-3.6-flash": GEMINI_3_FLASH,
  "gemini-3-flash-preview": GEMINI_3_FLASH,
  "gemini-3.5-flash": gemini3({ input: 1.5, cachedInput: 0.15, output: 9 }),
  "gemini-3.5-flash-lite": gemini3({ input: 0.3, cachedInput: 0.03, output: 2.5 }),
  "gemini-3.1-flash-lite": gemini3({ input: 0.25, cachedInput: 0.025, output: 1.5 }),
  "gemini-3.1-pro-preview": gemini3({ input: 2, cachedInput: 0.2, output: 12 }),
  "gemini-2.5-pro": gemini25({ input: 1.25, cachedInput: 0.125, output: 10 }),
  "gemini-2.5-flash": gemini25({ input: 0.3, cachedInput: 0.03, output: 2.5 }),
  "gemini-2.5-flash-lite": gemini25({ input: 0.1, cachedInput: 0.01, output: 0.4 }),
};

/** Google Custom Search: $5 per 1k queries (each paginated request is a query). */
const GOOGLE_CSE_PER_1K = 5;

function openai(rates: TokenRates): ModelPrice {
  return { rates, searchPer1k: OPENAI_SEARCH_PER_1K };
}

function gemini3(rates: TokenRates): ModelPrice {
  return { rates, searchPer1k: GEMINI_3_SEARCH_PER_1K };
}

function gemini25(rates: TokenRates): ModelPrice {
  return { rates, searchPer1k: GEMINI_2_5_SEARCH_PER_1K, searchPerPrompt: true };
}

export interface EstimateCostParams {
  provider: ProviderName;
  /** The model that served the search (ignored for SERP providers). */
  model?: string;
  usage: SearchUsage;
  /** Injectable for tests; defaults to the current time. */
  now?: Date;
}

/**
 * Estimate what a search cost at list price, or `undefined` when the model has
 * no known price (e.g. a model newer than this table).
 */
export function estimateCost(params: EstimateCostParams): SearchCost | undefined {
  const { usage } = params;

  if (params.provider === "google") {
    const searchUsd = (usage.searchCalls * GOOGLE_CSE_PER_1K) / 1000;
    return { totalUsd: searchUsd, tokensUsd: 0, searchUsd };
  }

  const table = params.provider === "openai" ? OPENAI_PRICES : GEMINI_PRICES;
  const price = params.model === undefined ? undefined : lookupPrice(table, params.model);
  if (price === undefined) {
    return undefined;
  }

  const rates = ratesAt(price, params.now ?? new Date());
  const inputTokens = usage.inputTokens ?? 0;
  const cachedInputTokens = Math.min(usage.cachedInputTokens ?? 0, inputTokens);
  const tokensUsd =
    ((inputTokens - cachedInputTokens) * rates.input +
      cachedInputTokens * rates.cachedInput +
      (usage.outputTokens ?? 0) * rates.output) /
    1_000_000;
  const billedSearches = price.searchPerPrompt ? Math.min(usage.searchCalls, 1) : usage.searchCalls;
  const searchUsd = (billedSearches * price.searchPer1k) / 1000;
  return { totalUsd: tokensUsd + searchUsd, tokensUsd, searchUsd };
}

// Dated snapshots (`gpt-5.5-2026-04-23`) and Vertex publisher paths share the base price.
function lookupPrice(table: Record<string, ModelPrice>, model: string): ModelPrice | undefined {
  const id = model
    .replace(/^(?:.*\/)?models\//, "")
    .replace(/-\d{4}-\d{2}-\d{2}$/, "")
    .toLowerCase();
  return Object.hasOwn(table, id) ? table[id] : undefined;
}

function ratesAt(price: ModelPrice, now: Date): TokenRates {
  if (price.next && now.toISOString().slice(0, 10) >= price.next.from) {
    return price.next.rates;
  }
  return price.rates;
}
