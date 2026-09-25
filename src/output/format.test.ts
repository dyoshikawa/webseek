import { describe, expect, it } from "vitest";

import type { NormalizedSearchResult } from "../providers/provider.js";
import { formatResult } from "./format.js";

const serp: NormalizedSearchResult = {
  provider: "google",
  query: "q",
  results: [{ title: "Example", url: "https://example.com", snippet: "An example." }],
  citations: [],
  searchQueries: ["q"],
  usage: { searchCalls: 1 },
  cost: { totalUsd: 0.005, tokensUsd: 0, searchUsd: 0.005 },
};

const grounded: NormalizedSearchResult = {
  provider: "openai",
  query: "q",
  results: [],
  answer: "The answer.",
  citations: [{ url: "https://src.dev", title: "Src" }],
  searchQueries: ["a query"],
  model: "gpt-5.5",
  usage: { inputTokens: 1200, outputTokens: 300, totalTokens: 1500, searchCalls: 1 },
  cost: { totalUsd: 0.025, tokensUsd: 0.015, searchUsd: 0.01 },
};

describe("formatResult", () => {
  it("renders SERP results as readable text", () => {
    const text = formatResult({ result: serp, json: false });
    expect(text).toContain("Results:");
    expect(text).toContain("1. Example");
    expect(text).toContain("https://example.com");
  });

  it("renders grounded answers with sources and searches", () => {
    const text = formatResult({ result: grounded, json: false });
    expect(text).toContain("The answer.");
    expect(text).toContain("Sources:");
    expect(text).toContain("[1] Src — https://src.dev");
    expect(text).toContain("Searches: a query");
  });

  it("emits normalized JSON and omits raw when absent", () => {
    const json = JSON.parse(formatResult({ result: grounded, json: true }));
    expect(json.provider).toBe("openai");
    expect(json.answer).toBe("The answer.");
    expect("raw" in json).toBe(false);
    expect(json.usage).toEqual(grounded.usage);
    expect(json.cost).toEqual(grounded.cost);
  });

  it("renders token usage and the estimated cost", () => {
    const text = formatResult({ result: grounded, json: false });
    expect(text).toContain("Usage: 1,500 tokens (1,200 in, 300 out), 1 search, ~$0.0250");
  });

  it("renders search-only usage for SERP providers", () => {
    const text = formatResult({ result: serp, json: false });
    expect(text).toContain("Usage: 1 search, ~$0.0050");
  });

  it("says the cost is unknown when the model has no price", () => {
    const text = formatResult({ result: { ...grounded, cost: undefined }, json: false });
    expect(text).toContain("1 search, cost unknown");
  });
});
