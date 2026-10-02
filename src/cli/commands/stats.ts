/**
 * `webseek stats` — summarize the searches recorded in the local usage log:
 * how many, the tokens and search calls they used, and their estimated cost.
 * Flags follow `opencode stats`.
 */

import type { Command } from "commander";

import type { Env } from "../../config/env.js";
import { coerceProvider } from "../../lib/search.js";
import type { ProviderName } from "../../providers/provider.js";
import { aggregateUsage, resolveStatsRange, type StatsRange } from "../../stats/aggregate.js";
import { renderStats } from "../../stats/render.js";
import { readUsageRecords } from "../../stats/usage-log.js";
import { WebseekError } from "../../utils/error.js";
import type { Logger } from "../../utils/logger.js";
import { wrapCommand } from "../wrap-command.js";

export interface StatsCommandOptions {
  days?: string;
  year?: string;
  all?: boolean;
  provider?: string;
  cost?: boolean;
  models?: boolean;
  full?: boolean;
  limit?: string;
  json?: boolean;
}

export interface StatsRequest {
  range: StatsRange;
  provider?: ProviderName;
  cost: boolean;
  models: boolean;
  limit?: number;
  json: boolean;
}

/** Validate CLI options into a stats request. Pure apart from reading `now`. */
export function toStatsRequest(params: { options: StatsCommandOptions; now?: Date }): StatsRequest {
  const { options } = params;
  const rangeFlags = [options.days !== undefined, options.year !== undefined, options.all];
  if (rangeFlags.filter(Boolean).length > 1) {
    throw new WebseekError({
      code: "invalid_usage",
      message: "--days, --year, and --all cannot be combined.",
    });
  }

  return {
    range: resolveStatsRange({
      days:
        options.days === undefined
          ? undefined
          : parseInteger({ name: "days", value: options.days, min: 0, max: 36_500 }),
      year:
        options.year === undefined
          ? undefined
          : parseInteger({ name: "year", value: options.year, min: 1970, max: 9999 }),
      all: options.all,
      now: params.now,
    }),
    provider: options.provider === undefined ? undefined : coerceProvider(options.provider),
    cost: Boolean(options.cost || options.full),
    models: Boolean(options.models || options.full),
    limit:
      options.limit === undefined
        ? undefined
        : parseInteger({
            name: "limit",
            value: options.limit,
            min: 1,
            max: Number.MAX_SAFE_INTEGER,
          }),
    json: Boolean(options.json),
  };
}

function parseInteger(params: { name: string; value: string; min: number; max: number }): number {
  const { name, value, min, max } = params;
  const parsed = Number(value);
  if (
    !/^\d+$/.test(value.trim()) ||
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new WebseekError({
      code: "invalid_usage",
      message: `--${name} must be an integer between ${min} and ${max}.`,
    });
  }
  return parsed;
}

export async function runStatsCommand(params: {
  logger: Logger;
  options: StatsCommandOptions;
  env?: Env;
}): Promise<void> {
  const request = toStatsRequest({ options: params.options });
  const records = await readUsageRecords({ env: params.env });
  const stats = aggregateUsage({ records, range: request.range, provider: request.provider });

  if (request.json) {
    const models =
      request.limit === undefined ? stats.models : stats.models.slice(0, request.limit);
    params.logger.result(JSON.stringify({ ...stats, models }, null, 2));
    return;
  }
  params.logger.result(
    renderStats({
      stats,
      label: request.range.label,
      scope: request.provider ?? "all providers",
      cost: request.cost,
      models: request.models,
      limit: request.limit,
    }),
  );
}

export function registerStatsCommand(program: Command): void {
  program
    .command("stats")
    .description("Show usage and estimated cost of the searches recorded locally")
    .option("--days <n>", "show the last N days; 0 means today")
    .option("--year <year>", "show a calendar year")
    .option("--all", "show lifetime statistics")
    .option("-p, --provider <name>", "only count one provider: openai | google | gemini")
    .option("--cost", "show cost and token details")
    .option("--models", "show usage per model")
    .option("--full", "show every detailed section")
    .option("--limit <n>", "number of rows in the models section")
    .option("--json", "output statistics as JSON")
    .action(
      wrapCommand(async ({ logger }, options: StatsCommandOptions) => {
        await runStatsCommand({ logger, options });
      }),
    );
}
