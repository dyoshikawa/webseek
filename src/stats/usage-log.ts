/**
 * The local usage log: one JSON line per successful search, appended by the
 * CLI and the MCP server and read back by `webseek stats`.
 *
 * Records hold what a search consumed and cost — never the query text — so the
 * log is safe to keep around. The library entry point never writes to it.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import type { Env } from "../config/env.js";
import { PROVIDER_NAMES } from "../lib/search.js";
import type {
  NormalizedSearchResult,
  ProviderName,
  SearchCost,
  SearchUsage,
} from "../providers/provider.js";

export const USAGE_LOG_FILE = "usage.jsonl";

const RECORD_VERSION = 1;

/** One logged search. */
export interface UsageRecord {
  v: typeof RECORD_VERSION;
  /** When the search finished, as epoch milliseconds. */
  at: number;
  provider: ProviderName;
  model?: string;
  usage?: SearchUsage;
  cost?: SearchCost;
}

/**
 * The directory the usage log lives in: `WEBSEEK_DATA_DIR`, else
 * `$XDG_DATA_HOME/webseek`, else `~/.local/share/webseek`.
 */
export function resolveDataDir(params: { env?: Env } = {}): string {
  const env = params.env ?? process.env;
  if (env.WEBSEEK_DATA_DIR) {
    return env.WEBSEEK_DATA_DIR;
  }
  if (env.XDG_DATA_HOME) {
    return join(env.XDG_DATA_HOME, "webseek");
  }
  return join(homedir(), ".local", "share", "webseek");
}

export function resolveUsageLogPath(params: { env?: Env } = {}): string {
  return join(resolveDataDir(params), USAGE_LOG_FILE);
}

/** Logging is on unless `WEBSEEK_USAGE_LOG` is `0`, `false` or `off`. */
export function isUsageLogEnabled(params: { env?: Env } = {}): boolean {
  const env = params.env ?? process.env;
  const value = env.WEBSEEK_USAGE_LOG?.trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "off";
}

export function toUsageRecord(params: {
  result: NormalizedSearchResult;
  now?: number;
}): UsageRecord {
  const { result } = params;
  return {
    v: RECORD_VERSION,
    at: params.now ?? Date.now(),
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    cost: result.cost,
  };
}

/**
 * Append a search to the usage log. Never throws: a failed write is reported
 * through `onError` so it cannot fail (or corrupt the output of) the search.
 */
export async function appendUsageRecord(params: {
  result: NormalizedSearchResult;
  env?: Env;
  now?: number;
  onError?: (error: unknown) => void;
}): Promise<void> {
  if (!isUsageLogEnabled({ env: params.env })) {
    return;
  }
  try {
    const dir = resolveDataDir({ env: params.env });
    await mkdir(dir, { recursive: true });
    const record = toUsageRecord({ result: params.result, now: params.now });
    await appendFile(join(dir, USAGE_LOG_FILE), `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    params.onError?.(error);
  }
}

/** Read every valid record from the usage log; a missing log reads as empty. */
export async function readUsageRecords(params: { env?: Env } = {}): Promise<UsageRecord[]> {
  let text: string;
  try {
    text = await readFile(resolveUsageLogPath(params), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return parseUsageRecords(text);
}

const usageRecordSchema = z.looseObject({
  v: z.literal(RECORD_VERSION),
  at: z.number(),
  provider: z.enum(PROVIDER_NAMES),
  model: z.string().optional(),
  usage: z
    .looseObject({
      inputTokens: z.number().optional(),
      cachedInputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
      searchCalls: z.number(),
    })
    .optional(),
  cost: z
    .looseObject({ totalUsd: z.number(), tokensUsd: z.number(), searchUsd: z.number() })
    .optional(),
});

/** Parse JSONL, skipping blank, malformed and unknown-version lines. */
export function parseUsageRecords(text: string): UsageRecord[] {
  const records: UsageRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      // A torn or hand-edited line should not hide the rest of the log.
      continue;
    }
    const parsed = usageRecordSchema.safeParse(json);
    if (parsed.success) {
      records.push(parsed.data);
    }
  }
  return records;
}
