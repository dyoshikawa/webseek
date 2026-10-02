/**
 * Renders aggregated usage as the `webseek stats` text report, laid out after
 * `opencode stats`: a summary by default, plus COST & TOKENS and MODELS
 * sections on request.
 */

import { formatUsd } from "../output/format.js";
import type { ModelStats, UsageStats } from "./aggregate.js";

export interface RenderStatsParams {
  stats: UsageStats;
  label: string;
  scope: string;
  cost: boolean;
  models: boolean;
  /** Maximum rows in the MODELS section. */
  limit?: number;
}

export function renderStats(params: RenderStatsParams): string {
  const { stats } = params;
  const detailed = params.cost || params.models;
  const header = `webseek stats · ${params.label} · ${params.scope}`;
  const lines: string[] = [];

  if (detailed) {
    lines.push(`${params.label} · ${params.scope}`);
  } else if (stats.searches === 0) {
    lines.push(header, "", "no searches in this range");
  } else {
    lines.push(
      header,
      "",
      `${plural({ value: stats.searches, singular: "search", pluralForm: "searches" })} · ${plural({ value: stats.searchCalls, singular: "search call" })} · ${plural({ value: stats.tokens.total, singular: "token" })}`,
      `~${formatUsd(stats.cost.totalUsd)} estimated · ${plural({ value: stats.activeDays, singular: "active day" })}`,
    );
    if (stats.unpricedSearches > 0) {
      lines.push(
        `${plural({ value: stats.unpricedSearches, singular: "search", pluralForm: "searches" })} without a price estimate`,
      );
    }
  }

  if (params.cost) {
    lines.push("", ...renderCost(stats));
  }
  if (params.models) {
    lines.push("", ...renderModels({ models: stats.models, limit: params.limit }));
  }
  return lines.join("\n");
}

function renderCost(stats: UsageStats): string[] {
  const rows: [label: string, value: string][] = [
    ["cost", `~${formatUsd(stats.cost.totalUsd)}`],
    ["  tokens", formatUsd(stats.cost.tokensUsd)],
    ["  search fees", formatUsd(stats.cost.searchUsd)],
    ["input", compact(stats.tokens.input)],
    ["cached input", compact(stats.tokens.cachedInput)],
    ["output", compact(stats.tokens.output)],
    ["search calls", compact(stats.searchCalls)],
  ];
  if (stats.unpricedSearches > 0) {
    rows.push(["unpriced searches", compact(stats.unpricedSearches)]);
  }
  return ["COST & TOKENS", ...rows.map(([label, value]) => `  ${label.padEnd(20)}${value}`)];
}

function renderModels(params: { models: ModelStats[]; limit?: number }): string[] {
  const { models, limit } = params;
  if (models.length === 0) {
    return ["MODELS", "  no searches"];
  }
  const shown = limit === undefined ? models : models.slice(0, limit);
  const rest = models.length - shown.length;
  return [
    "MODELS",
    tableRow({ name: "model", searches: "searches", tokens: "tokens", cost: "cost" }),
    ...shown.map((model) =>
      tableRow({
        name: modelName(model),
        searches: compact(model.searches),
        tokens: compact(model.tokens),
        cost: model.unpricedSearches === model.searches ? "-" : formatUsd(model.costUsd),
      }),
    ),
    ...(rest > 0
      ? ["", `+${rest.toLocaleString("en-US")} more model${rest === 1 ? "" : "s"}`]
      : []),
  ];
}

function modelName(model: ModelStats): string {
  return model.model ? `${model.provider}/${model.model}` : model.provider;
}

function tableRow(cells: { name: string; searches: string; tokens: string; cost: string }): string {
  const name = cells.name.length <= 34 ? cells.name : `${cells.name.slice(0, 33)}…`;
  return `${name.padEnd(34)}${cells.searches.padStart(10)}${cells.tokens.padStart(10)}${cells.cost.padStart(12)}`;
}

/** 1234 → "1.2k", 2_000_000 → "2m". */
export function compact(value: number): string {
  if (value >= 1e9) {
    return `${oneDecimal(value / 1e9)}b`;
  }
  if (value >= 1e6) {
    return `${oneDecimal(value / 1e6)}m`;
  }
  if (value >= 1000) {
    return `${oneDecimal(value / 1000)}k`;
  }
  return Math.round(value).toLocaleString("en-US");
}

function oneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function plural(params: { value: number; singular: string; pluralForm?: string }): string {
  const noun = params.value === 1 ? params.singular : (params.pluralForm ?? `${params.singular}s`);
  return `${compact(params.value)} ${noun}`;
}
