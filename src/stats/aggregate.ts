/**
 * Turns usage-log records into the totals `webseek stats` prints: a time range
 * (modelled on `opencode stats`), overall tokens/searches/cost, and a
 * per-model breakdown.
 */

import type { ProviderName } from "../providers/provider.js";
import type { UsageRecord } from "./usage-log.js";

export interface StatsRange {
  /** Inclusive lower bound in epoch ms; absent for all time. */
  from?: number;
  /** Exclusive upper bound in epoch ms. */
  to: number;
  label: string;
}

export interface ResolveStatsRangeParams {
  days?: number;
  year?: number;
  all?: boolean;
  now?: Date;
}

/**
 * `--all` → all time; `--days N` → since local midnight N-1 days ago (0 or 1
 * mean today); `--year Y` → that calendar year; default → this year so far.
 */
export function resolveStatsRange(params: ResolveStatsRangeParams = {}): StatsRange {
  const now = params.now ?? new Date();
  const to = now.getTime() + 1;
  if (params.all) {
    return { from: undefined, to, label: "all time" };
  }
  if (params.days !== undefined) {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    from.setDate(from.getDate() - Math.max(0, params.days - 1));
    return {
      from: from.getTime(),
      to,
      label: params.days <= 1 ? "today" : `last ${params.days} days`,
    };
  }
  const year = params.year ?? now.getFullYear();
  const isCurrentYear = year === now.getFullYear();
  return {
    from: new Date(year, 0, 1).getTime(),
    to: isCurrentYear ? to : new Date(year + 1, 0, 1).getTime(),
    label: isCurrentYear ? `${year} so far` : String(year),
  };
}

export interface StatsTokens {
  input: number;
  cachedInput: number;
  output: number;
  total: number;
}

export interface StatsCost {
  totalUsd: number;
  tokensUsd: number;
  searchUsd: number;
}

export interface ModelStats {
  provider: ProviderName;
  /** Absent for providers without a model (Google Custom Search). */
  model?: string;
  searches: number;
  searchCalls: number;
  tokens: number;
  costUsd: number;
  /** Searches with no cost estimate; excluded from `costUsd`. */
  unpricedSearches: number;
}

export interface UsageStats {
  range: { from?: number; to: number };
  /** Searches logged (one per CLI run or MCP tool call). */
  searches: number;
  /** Searches the providers ran on our behalf (tool calls, grounding queries, SERP requests). */
  searchCalls: number;
  tokens: StatsTokens;
  cost: StatsCost;
  /** Searches with no cost estimate (unknown model price); excluded from `cost`. */
  unpricedSearches: number;
  /** Distinct local calendar days with at least one search. */
  activeDays: number;
  /** Sorted by cost, then searches, descending. */
  models: ModelStats[];
}

export function aggregateUsage(params: {
  records: UsageRecord[];
  range: StatsRange;
  provider?: ProviderName;
}): UsageStats {
  const { range } = params;
  const stats: UsageStats = {
    range: { from: range.from, to: range.to },
    searches: 0,
    searchCalls: 0,
    tokens: { input: 0, cachedInput: 0, output: 0, total: 0 },
    cost: { totalUsd: 0, tokensUsd: 0, searchUsd: 0 },
    unpricedSearches: 0,
    activeDays: 0,
    models: [],
  };
  const days = new Set<string>();
  const models = new Map<string, ModelStats>();

  for (const record of params.records) {
    const inRange = (range.from === undefined || record.at >= range.from) && record.at < range.to;
    if (!inRange || (params.provider !== undefined && record.provider !== params.provider)) {
      continue;
    }
    addRecord({ stats, models, record });
    const at = new Date(record.at);
    days.add(`${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`);
  }

  stats.activeDays = days.size;
  stats.models = [...models.values()].toSorted(
    (a, b) => b.costUsd - a.costUsd || b.searches - a.searches,
  );
  return stats;
}

function addRecord(params: {
  stats: UsageStats;
  models: Map<string, ModelStats>;
  record: UsageRecord;
}): void {
  const { stats, record } = params;
  const usage = record.usage;
  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  const total = usage?.totalTokens ?? input + output;
  const searchCalls = usage?.searchCalls ?? 0;

  stats.searches += 1;
  stats.searchCalls += searchCalls;
  stats.tokens.input += input;
  stats.tokens.cachedInput += usage?.cachedInputTokens ?? 0;
  stats.tokens.output += output;
  stats.tokens.total += total;
  if (record.cost) {
    stats.cost.totalUsd += record.cost.totalUsd;
    stats.cost.tokensUsd += record.cost.tokensUsd;
    stats.cost.searchUsd += record.cost.searchUsd;
  } else {
    stats.unpricedSearches += 1;
  }

  const key = `${record.provider}/${record.model ?? ""}`;
  const model = params.models.get(key) ?? {
    provider: record.provider,
    model: record.model,
    searches: 0,
    searchCalls: 0,
    tokens: 0,
    costUsd: 0,
    unpricedSearches: 0,
  };
  model.searches += 1;
  model.searchCalls += searchCalls;
  model.tokens += total;
  model.costUsd += record.cost?.totalUsd ?? 0;
  if (!record.cost) {
    model.unpricedSearches += 1;
  }
  params.models.set(key, model);
}
