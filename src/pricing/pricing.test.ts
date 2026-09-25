import { describe, expect, it } from "vitest";

import { estimateCost } from "./pricing.js";

describe("estimateCost", () => {
  it("prices OpenAI tokens (cached input at the cached rate) plus web search calls", () => {
    const cost = estimateCost({
      provider: "openai",
      model: "gpt-5.5",
      usage: { inputTokens: 10_000, cachedInputTokens: 2_000, outputTokens: 1_000, searchCalls: 2 },
    });

    // 8k × $5 + 2k × $0.5 + 1k × $30 per 1M, plus 2 × $10 per 1k calls.
    expect(cost?.tokensUsd).toBeCloseTo(0.071);
    expect(cost?.searchUsd).toBeCloseTo(0.02);
    expect(cost?.totalUsd).toBeCloseTo(0.091);
  });

  it("matches dated OpenAI snapshots to their base model", () => {
    const cost = estimateCost({
      provider: "openai",
      model: "gpt-5-mini-2025-08-07",
      usage: { inputTokens: 1_000_000, searchCalls: 0 },
    });
    expect(cost?.totalUsd).toBeCloseTo(0.25);
  });

  it("does not mistake an unknown model for a known prefix", () => {
    const cost = estimateCost({
      provider: "openai",
      model: "gpt-5.5-pro",
      usage: { inputTokens: 1_000, searchCalls: 1 },
    });
    expect(cost).toBeUndefined();
  });

  it("bills Gemini 3.x search per query", () => {
    const cost = estimateCost({
      provider: "gemini",
      model: "gemini-3.1-flash-lite",
      usage: { inputTokens: 0, outputTokens: 0, searchCalls: 3 },
    });
    expect(cost?.searchUsd).toBeCloseTo(0.042);
  });

  it("bills Gemini 2.5 search once per grounded prompt", () => {
    const cost = estimateCost({
      provider: "gemini",
      model: "gemini-2.5-flash",
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, searchCalls: 3 },
    });
    expect(cost?.tokensUsd).toBeCloseTo(2.8);
    expect(cost?.searchUsd).toBeCloseTo(0.035);
  });

  it("switches to the next rates on their effective date", () => {
    const usage = { inputTokens: 1_000_000, searchCalls: 0 };
    const before = estimateCost({
      provider: "gemini",
      model: "gemini-3.8-flash",
      usage,
      now: new Date("2026-12-31T23:59:59Z"),
    });
    const after = estimateCost({
      provider: "gemini",
      model: "gemini-3.8-flash",
      usage,
      now: new Date("2027-01-01T00:00:00Z"),
    });
    expect(before?.totalUsd).toBeCloseTo(0.75);
    expect(after?.totalUsd).toBeCloseTo(1.5);
  });

  it("prices Google Custom Search per request", () => {
    const cost = estimateCost({ provider: "google", usage: { searchCalls: 3 } });
    expect(cost).toEqual({ totalUsd: 0.015, tokensUsd: 0, searchUsd: 0.015 });
  });
});
