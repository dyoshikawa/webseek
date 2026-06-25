import { describe, expect, it } from "vitest";

import { toSearchRequest } from "./search.js";

describe("toSearchRequest", () => {
  it("joins query parts and applies defaults", () => {
    expect(
      toSearchRequest({ queryParts: ["hello", "world"], options: { provider: "google" } }),
    ).toMatchObject({ provider: "google", query: "hello world", includeRaw: false });
  });

  it("throws when the query is empty", () => {
    expect(() => toSearchRequest({ queryParts: [], options: { provider: "google" } })).toThrowError(
      /query/i,
    );
  });

  it("throws on an invalid provider", () => {
    expect(() =>
      toSearchRequest({ queryParts: ["q"], options: { provider: "bing" } }),
    ).toThrowError(/provider/i);
  });

  it("parses max-results and validates the gemini backend", () => {
    const request = toSearchRequest({
      queryParts: ["q"],
      options: { provider: "gemini", maxResults: "5", geminiBackend: "vertex-express" },
    });
    expect(request.maxResults).toBe(5);
    expect(request.geminiBackend).toBe("vertex-express");
  });

  it("rejects a non-positive max-results", () => {
    expect(() =>
      toSearchRequest({ queryParts: ["q"], options: { provider: "google", maxResults: "0" } }),
    ).toThrowError(/max-results/);
  });
});
