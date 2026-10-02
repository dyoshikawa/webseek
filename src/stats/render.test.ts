import { describe, expect, it } from "vitest";

import type { UsageStats } from "./aggregate.js";
import { compact, renderStats } from "./render.js";

const stats: UsageStats = {
  range: { from: 0, to: 1 },
  searches: 3,
  searchCalls: 4,
  tokens: { input: 12_100, cachedInput: 2_000, output: 850, total: 12_950 },
  cost: { totalUsd: 0.055, tokensUsd: 0.03, searchUsd: 0.025 },
  unpricedSearches: 1,
  activeDays: 1,
  models: [
    {
      provider: "openai",
      model: "gpt-5.5",
      searches: 1,
      searchCalls: 2,
      tokens: 12_800,
      costUsd: 0.05,
      unpricedSearches: 0,
    },
    {
      provider: "google",
      searches: 1,
      searchCalls: 1,
      tokens: 0,
      costUsd: 0.005,
      unpricedSearches: 0,
    },
    {
      provider: "gemini",
      model: "gemini-next",
      searches: 1,
      searchCalls: 1,
      tokens: 150,
      costUsd: 0,
      unpricedSearches: 1,
    },
  ],
};

const base = { stats, label: "2026 so far", scope: "all providers", cost: false, models: false };

describe("renderStats", () => {
  it("prints a summary by default", () => {
    expect(renderStats(base)).toBe(
      [
        "webseek stats · 2026 so far · all providers",
        "",
        "3 searches · 4 search calls · 12.9k tokens",
        "~$0.0550 estimated · 1 active day",
        "1 search without a price estimate",
      ].join("\n"),
    );
  });

  it("prints an empty state", () => {
    const empty = { ...stats, searches: 0, models: [] };
    expect(renderStats({ ...base, stats: empty })).toContain("no searches in this range");
  });

  it("prints the cost and model sections", () => {
    const text = renderStats({ ...base, cost: true, models: true, limit: 2 });
    expect(text.split("\n")[0]).toBe("2026 so far · all providers");
    expect(text).toContain("COST & TOKENS");
    expect(text).toContain("  cost                ~$0.0550");
    expect(text).toContain("    search fees       $0.0250");
    expect(text).toContain("  unpriced searches   1");
    expect(text).toMatch(/^openai\/gpt-5\.5 +1 +12\.8k +\$0\.0500$/m);
    expect(text).toMatch(/^google +1 +0 +\$0\.0050$/m);
    expect(text).not.toContain("gemini-next");
    expect(text).toContain("+1 more model");
  });

  it("shows a dash for a model without any price", () => {
    const text = renderStats({ ...base, models: true });
    expect(text).toMatch(/^gemini\/gemini-next +1 +150 +-$/m);
  });

  it("strips control characters from model names", () => {
    const hostile = { ...stats.models[0]!, model: "gpt\u001b[2Jx" };
    const text = renderStats({ ...base, stats: { ...stats, models: [hostile] }, models: true });
    expect(text).toContain("openai/gpt[2Jx");
    expect(text).not.toContain("\u001b");
  });
});

describe("compact", () => {
  it("abbreviates large numbers", () => {
    expect(compact(999)).toBe("999");
    expect(compact(1_000)).toBe("1k");
    expect(compact(12_950)).toBe("12.9k");
    expect(compact(2_500_000)).toBe("2.5m");
    expect(compact(3_000_000_000)).toBe("3b");
  });
});
