/**
 * Renders a normalized search result as either machine-readable JSON or
 * human-readable text.
 */

import type { NormalizedSearchResult, SearchCost, SearchUsage } from "../providers/provider.js";
import { stripControlChars } from "../utils/sanitize.js";

export interface FormatParams {
  result: NormalizedSearchResult;
  json: boolean;
}

export function formatResult(params: FormatParams): string {
  if (params.json) {
    return formatJson(params.result);
  }
  return formatText(params.result);
}

function formatJson(result: NormalizedSearchResult): string {
  // Drop `raw` when undefined so JSON output stays clean unless --raw was used.
  const payload: Record<string, unknown> = {
    provider: result.provider,
    query: result.query,
    results: result.results,
    answer: result.answer,
    citations: result.citations,
    searchQueries: result.searchQueries,
    model: result.model,
    usage: result.usage,
    cost: result.cost,
  };
  if (result.raw !== undefined) {
    payload.raw = result.raw;
  }
  return JSON.stringify(payload, null, 2);
}

function formatText(result: NormalizedSearchResult): string {
  const lines: string[] = [];

  if (result.answer) {
    lines.push(stripControlChars(result.answer).trim(), "");
  }

  if (result.results.length > 0) {
    lines.push("Results:");
    result.results.forEach((item, index) => {
      const title = stripControlChars(item.title);
      const url = stripControlChars(item.url);
      lines.push(`${index + 1}. ${title || url}`);
      lines.push(`   ${url}`);
      if (item.snippet) {
        lines.push(`   ${stripControlChars(item.snippet)}`);
      }
    });
    lines.push("");
  }

  if (result.citations.length > 0) {
    lines.push("Sources:");
    result.citations.forEach((citation, index) => {
      const url = stripControlChars(citation.url);
      const title = citation.title ? stripControlChars(citation.title) : "";
      const label = title ? `${title} — ${url}` : url;
      lines.push(`  [${index + 1}] ${label}`);
    });
    lines.push("");
  }

  if (result.searchQueries.length > 0) {
    lines.push(`Searches: ${result.searchQueries.map(stripControlChars).join(" | ")}`);
  }

  if (result.usage) {
    lines.push(formatUsage({ usage: result.usage, cost: result.cost }));
  }

  return lines.join("\n").trimEnd();
}

interface FormatUsageParams {
  usage: SearchUsage;
  cost: SearchCost | undefined;
}

function formatUsage(params: FormatUsageParams): string {
  const { usage, cost } = params;
  const parts: string[] = [];
  if (usage.inputTokens !== undefined || usage.outputTokens !== undefined) {
    const input = usage.inputTokens ?? 0;
    const output = usage.outputTokens ?? 0;
    const total = usage.totalTokens ?? input + output;
    parts.push(
      `${total.toLocaleString("en-US")} tokens (${input.toLocaleString("en-US")} in, ${output.toLocaleString("en-US")} out)`,
    );
  }
  parts.push(`${usage.searchCalls} search${usage.searchCalls === 1 ? "" : "es"}`);
  parts.push(cost === undefined ? "cost unknown" : `~${formatUsd(cost.totalUsd)}`);
  return `Usage: ${parts.join(", ")}`;
}

export function formatUsd(value: number): string {
  // Searches cost fractions of a cent, so show four decimal places; a non-zero
  // cost below that would otherwise print as $0.0000.
  if (value > 0 && value < 0.00005) {
    return "<$0.0001";
  }
  return `$${value.toFixed(4)}`;
}
