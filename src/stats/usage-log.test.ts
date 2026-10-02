import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { NormalizedSearchResult } from "../providers/provider.js";
import {
  appendUsageRecord,
  isUsageLogEnabled,
  parseUsageRecords,
  readUsageRecords,
  resolveDataDir,
} from "./usage-log.js";

const result: NormalizedSearchResult = {
  provider: "openai",
  query: "secret query",
  results: [],
  answer: "answer",
  citations: [],
  searchQueries: [],
  model: "gpt-5.5",
  usage: { inputTokens: 1_000, outputTokens: 100, totalTokens: 1_100, searchCalls: 1 },
  cost: { totalUsd: 0.018, tokensUsd: 0.008, searchUsd: 0.01 },
};

describe("resolveDataDir", () => {
  it("prefers WEBSEEK_DATA_DIR, then XDG_DATA_HOME", () => {
    expect(resolveDataDir({ env: { WEBSEEK_DATA_DIR: "/a", XDG_DATA_HOME: "/b" } })).toBe("/a");
    expect(resolveDataDir({ env: { XDG_DATA_HOME: "/b" } })).toBe(join("/b", "webseek"));
    expect(resolveDataDir({ env: {} })).toMatch(/[/\\]\.local[/\\]share[/\\]webseek$/);
  });
});

describe("isUsageLogEnabled", () => {
  it("is on unless WEBSEEK_USAGE_LOG turns it off", () => {
    expect(isUsageLogEnabled({ env: {} })).toBe(true);
    expect(isUsageLogEnabled({ env: { WEBSEEK_USAGE_LOG: "1" } })).toBe(true);
    for (const value of ["0", "false", "OFF"]) {
      expect(isUsageLogEnabled({ env: { WEBSEEK_USAGE_LOG: value } })).toBe(false);
    }
  });
});

describe("usage log file", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "webseek-usage-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("appends one line per search without the query and reads it back", async () => {
    const env = { WEBSEEK_DATA_DIR: join(dir, "nested") };
    await appendUsageRecord({ result, env, now: 1 });
    await appendUsageRecord({
      result: { ...result, provider: "google", model: undefined },
      env,
      now: 2,
    });

    const text = await readFile(join(dir, "nested", "usage.jsonl"), "utf8");
    expect(text.trim().split("\n")).toHaveLength(2);
    expect(text).not.toContain("secret query");

    const records = await readUsageRecords({ env });
    expect(records).toEqual([
      { v: 1, at: 1, provider: "openai", model: "gpt-5.5", usage: result.usage, cost: result.cost },
      { v: 1, at: 2, provider: "google", usage: result.usage, cost: result.cost },
    ]);
  });

  it("writes nothing when disabled", async () => {
    const env = { WEBSEEK_DATA_DIR: dir, WEBSEEK_USAGE_LOG: "off" };
    await appendUsageRecord({ result, env });
    expect(await readUsageRecords({ env: { WEBSEEK_DATA_DIR: dir } })).toEqual([]);
  });

  it("reports a failed write instead of throwing", async () => {
    const file = join(dir, "not-a-dir");
    await writeFile(file, "");
    const errors: unknown[] = [];
    await appendUsageRecord({
      result,
      env: { WEBSEEK_DATA_DIR: file },
      onError: (error) => errors.push(error),
    });
    expect(errors).toHaveLength(1);
  });

  it("reads a missing log as empty", async () => {
    expect(await readUsageRecords({ env: { WEBSEEK_DATA_DIR: join(dir, "none") } })).toEqual([]);
  });
});

describe("parseUsageRecords", () => {
  it("skips blank, malformed and unknown records", () => {
    const text = [
      JSON.stringify({ v: 1, at: 5, provider: "gemini" }),
      "",
      "{torn",
      JSON.stringify({ v: 2, at: 5, provider: "gemini" }),
      JSON.stringify({ v: 1, at: 5, provider: "bing" }),
    ].join("\n");
    expect(parseUsageRecords(text)).toEqual([{ v: 1, at: 5, provider: "gemini" }]);
  });
});
