import { describe, expect, it } from "vitest";

import { aggregateUsage, resolveStatsRange } from "./aggregate.js";
import type { UsageRecord } from "./usage-log.js";

const now = new Date(2026, 9, 1, 15, 30);

describe("resolveStatsRange", () => {
  it("defaults to this year so far", () => {
    expect(resolveStatsRange({ now })).toEqual({
      from: new Date(2026, 0, 1).getTime(),
      to: now.getTime() + 1,
      label: "2026 so far",
    });
  });

  it("covers a past calendar year", () => {
    expect(resolveStatsRange({ now, year: 2025 })).toEqual({
      from: new Date(2025, 0, 1).getTime(),
      to: new Date(2026, 0, 1).getTime(),
      label: "2025",
    });
  });

  it("counts --days from local midnight, with 0 and 1 meaning today", () => {
    expect(resolveStatsRange({ now, days: 0 })).toMatchObject({
      from: new Date(2026, 9, 1).getTime(),
      label: "today",
    });
    expect(resolveStatsRange({ now, days: 1 }).from).toBe(new Date(2026, 9, 1).getTime());
    expect(resolveStatsRange({ now, days: 7 })).toMatchObject({
      from: new Date(2026, 8, 25).getTime(),
      label: "last 7 days",
    });
  });

  it("has no lower bound for all time", () => {
    expect(resolveStatsRange({ now, all: true })).toEqual({
      from: undefined,
      to: now.getTime() + 1,
      label: "all time",
    });
  });
});

function record(overrides: Partial<UsageRecord>): UsageRecord {
  return { v: 1, at: new Date(2026, 9, 1, 9).getTime(), provider: "openai", ...overrides };
}

describe("aggregateUsage", () => {
  const records: UsageRecord[] = [
    record({
      model: "gpt-5.5",
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 200,
        outputTokens: 100,
        totalTokens: 1_100,
        searchCalls: 1,
      },
      cost: { totalUsd: 0.018, tokensUsd: 0.008, searchUsd: 0.01 },
    }),
    record({
      at: new Date(2026, 8, 30, 9).getTime(),
      model: "gpt-5.5",
      usage: { inputTokens: 500, outputTokens: 50, searchCalls: 2 },
      cost: { totalUsd: 0.03, tokensUsd: 0.01, searchUsd: 0.02 },
    }),
    record({
      provider: "google",
      usage: { searchCalls: 1 },
      cost: { totalUsd: 0.005, tokensUsd: 0, searchUsd: 0.005 },
    }),
    record({ provider: "gemini", model: "gemini-next", usage: { searchCalls: 1 } }),
    record({ at: new Date(2025, 11, 31).getTime(), model: "gpt-5.5" }),
  ];
  const range = resolveStatsRange({ now });

  it("totals the records in range and breaks them down per model", () => {
    const stats = aggregateUsage({ records, range });
    expect(stats).toMatchObject({
      searches: 4,
      searchCalls: 5,
      tokens: { input: 1_500, cachedInput: 200, output: 150, total: 1_650 },
      unpricedSearches: 1,
      activeDays: 2,
    });
    expect(stats.cost.totalUsd).toBeCloseTo(0.053, 9);
    expect(stats.cost.tokensUsd).toBeCloseTo(0.018, 9);
    expect(stats.cost.searchUsd).toBeCloseTo(0.035, 9);
    expect(stats.models.map((model) => [model.provider, model.model, model.searches])).toEqual([
      ["openai", "gpt-5.5", 2],
      ["google", undefined, 1],
      ["gemini", "gemini-next", 1],
    ]);
    expect(stats.models[0]).toMatchObject({ searchCalls: 3, tokens: 1_650, unpricedSearches: 0 });
    expect(stats.models[2]).toMatchObject({ costUsd: 0, unpricedSearches: 1 });
  });

  it("filters by provider", () => {
    const stats = aggregateUsage({ records, range, provider: "google" });
    expect(stats.searches).toBe(1);
    expect(stats.models).toHaveLength(1);
  });

  it("is empty when nothing is in range", () => {
    const stats = aggregateUsage({ records, range: resolveStatsRange({ now, year: 2024 }) });
    expect(stats).toMatchObject({ searches: 0, activeDays: 0, models: [] });
  });
});
