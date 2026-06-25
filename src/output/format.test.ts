import { describe, expect, it } from "vitest";

import type { NormalizedSearchResult } from "../providers/provider.js";
import { formatResult } from "./format.js";

const serp: NormalizedSearchResult = {
  provider: "google",
  query: "q",
  results: [{ title: "Example", url: "https://example.com", snippet: "An example." }],
  citations: [],
  searchQueries: ["q"],
};

const grounded: NormalizedSearchResult = {
  provider: "openai",
  query: "q",
  results: [],
  answer: "The answer.",
  citations: [{ url: "https://src.dev", title: "Src" }],
  searchQueries: ["a query"],
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
  });
});
