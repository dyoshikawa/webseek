/**
 * Renders a normalized search result as either machine-readable JSON or
 * human-readable text.
 */

import type { NormalizedSearchResult } from "../providers/provider.js";

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
  };
  if (result.raw !== undefined) {
    payload.raw = result.raw;
  }
  return JSON.stringify(payload, null, 2);
}

function formatText(result: NormalizedSearchResult): string {
  const lines: string[] = [];

  if (result.answer) {
    lines.push(result.answer.trim(), "");
  }

  if (result.results.length > 0) {
    lines.push("Results:");
    result.results.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title || item.url}`);
      lines.push(`   ${item.url}`);
      if (item.snippet) {
        lines.push(`   ${item.snippet}`);
      }
    });
    lines.push("");
  }

  if (result.citations.length > 0) {
    lines.push("Sources:");
    result.citations.forEach((citation, index) => {
      const label = citation.title ? `${citation.title} — ${citation.url}` : citation.url;
      lines.push(`  [${index + 1}] ${label}`);
    });
    lines.push("");
  }

  if (result.searchQueries.length > 0) {
    lines.push(`Searches: ${result.searchQueries.join(" | ")}`);
  }

  return lines.join("\n").trimEnd();
}
