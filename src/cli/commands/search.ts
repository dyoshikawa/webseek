/**
 * `webseek search <query...>` — run a web search via a provider and print
 * the result (text by default, normalized JSON with --json).
 */

import type { Command } from "commander";

import {
  coerceGeminiBackend,
  coerceMaxResults,
  coerceProvider,
  type RunSearchParams,
  runSearch,
} from "../../lib/search.js";
import { formatResult } from "../../output/format.js";
import { WebseekError } from "../../utils/error.js";
import type { Logger } from "../../utils/logger.js";
import { wrapCommand } from "../wrap-command.js";

export interface SearchCommandOptions {
  provider?: string;
  maxResults?: string;
  model?: string;
  geminiBackend?: string;
  json?: boolean;
  raw?: boolean;
}

/**
 * Translate raw CLI args/options into validated `runSearch` parameters. Kept
 * pure (no I/O) so it can be unit-tested directly.
 */
export function toSearchRequest(params: {
  queryParts: string[];
  options: SearchCommandOptions;
}): Omit<RunSearchParams, "env" | "fetchImpl"> {
  const query = params.queryParts.join(" ").trim();
  if (!query) {
    throw new WebseekError({ code: "invalid_usage", message: "Missing search query." });
  }

  return {
    provider: coerceProvider(params.options.provider),
    query,
    maxResults:
      params.options.maxResults === undefined
        ? undefined
        : coerceMaxResults(params.options.maxResults),
    model: params.options.model,
    includeRaw: Boolean(params.options.raw),
    geminiBackend:
      params.options.geminiBackend === undefined
        ? undefined
        : coerceGeminiBackend(params.options.geminiBackend),
  };
}

export async function runSearchCommand(params: {
  logger: Logger;
  queryParts: string[];
  options: SearchCommandOptions;
}): Promise<void> {
  const request = toSearchRequest({ queryParts: params.queryParts, options: params.options });
  const result = await runSearch(request);
  params.logger.result(formatResult({ result, json: Boolean(params.options.json) }));
}

export function registerSearchCommand(program: Command): void {
  program
    .command("search")
    .description("Search the web via a provider")
    .argument("<query...>", "the search query")
    .requiredOption("-p, --provider <name>", "provider: openai | google | gemini")
    .option("-n, --max-results <number>", "desired number of results (SERP providers)")
    .option("-m, --model <name>", "model override (openai, gemini)")
    .option("--gemini-backend <backend>", "gemini backend: gemini-api | vertex-express")
    .option("--json", "emit normalized JSON instead of text")
    .option("--raw", "include the provider's raw response")
    .action(
      wrapCommand(async ({ logger }, queryParts: string[], options: SearchCommandOptions) => {
        await runSearchCommand({ logger, queryParts, options });
      }),
    );
}
