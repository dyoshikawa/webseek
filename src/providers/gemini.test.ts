import { describe, expect, it } from "vitest";

import { createFakeFetch } from "../test-utils/fake-fetch.js";
import { createGeminiProvider } from "./gemini.js";

const groundedBody = {
  candidates: [
    {
      content: { parts: [{ text: "Spain won Euro 2024." }] },
      groundingMetadata: {
        webSearchQueries: ["who won euro 2024"],
        groundingChunks: [{ web: { uri: "https://uefa.com/x", title: "uefa.com" } }],
      },
    },
  ],
};

describe("gemini provider", () => {
  it("gemini-api backend: uses x-goog-api-key header, snake_case tool, generativelanguage host", async () => {
    const fake = createFakeFetch([{ body: groundedBody }]);
    const provider = createGeminiProvider({
      config: {
        apiKey: "g-key",
        backend: "gemini-api",
        baseUrl: "https://generativelanguage.googleapis.com",
      },
    });

    const result = await provider.search({ query: "euro 2024", fetchImpl: fake.fetchImpl });

    expect(result.answer).toBe("Spain won Euro 2024.");
    expect(result.citations).toEqual([{ url: "https://uefa.com/x", title: "uefa.com" }]);
    expect(result.searchQueries).toEqual(["who won euro 2024"]);

    const request = fake.requests[0];
    const headers = request?.init?.headers as Record<string, string> | undefined;
    expect(request?.url).toContain("generativelanguage.googleapis.com");
    expect(headers?.["x-goog-api-key"]).toBe("g-key");
    expect(JSON.parse(String(request?.init?.body)).tools).toEqual([{ google_search: {} }]);
  });

  it("reports usage (thinking as output, tool-use prompt as input) and the estimated cost", async () => {
    const fake = createFakeFetch([
      {
        body: {
          ...groundedBody,
          modelVersion: "gemini-3.1-flash-lite",
          usageMetadata: {
            promptTokenCount: 100,
            toolUsePromptTokenCount: 900,
            candidatesTokenCount: 200,
            thoughtsTokenCount: 300,
            totalTokenCount: 1_500,
          },
        },
      },
    ]);
    const provider = createGeminiProvider({
      config: {
        apiKey: "g-key",
        backend: "gemini-api",
        baseUrl: "https://generativelanguage.googleapis.com",
      },
    });

    const result = await provider.search({
      query: "euro 2024",
      model: "gemini-3.1-flash-lite",
      fetchImpl: fake.fetchImpl,
    });

    expect(result.model).toBe("gemini-3.1-flash-lite");
    expect(result.usage).toEqual({
      inputTokens: 1_000,
      cachedInputTokens: undefined,
      outputTokens: 500,
      totalTokens: 1_500,
      searchCalls: 1,
    });
    // 1k × $0.25 + 500 × $1.5 per 1M, plus one query at $14 per 1k.
    expect(result.cost?.totalUsd).toBeCloseTo(0.000_25 + 0.000_75 + 0.014);
  });

  it("vertex-express backend: uses ?key= query param, camelCase tool, aiplatform host", async () => {
    const fake = createFakeFetch([{ body: groundedBody }]);
    const provider = createGeminiProvider({
      config: {
        apiKey: "v-key",
        backend: "vertex-express",
        baseUrl: "https://aiplatform.googleapis.com",
      },
    });

    await provider.search({ query: "euro 2024", fetchImpl: fake.fetchImpl });

    const request = fake.requests[0];
    expect(request?.url).toContain("aiplatform.googleapis.com");
    expect(request?.url).toContain("key=v-key");
    expect(JSON.parse(String(request?.init?.body)).tools).toEqual([{ googleSearch: {} }]);
  });

  it("returns an empty answer when the model did not ground", async () => {
    const fake = createFakeFetch([
      { body: { candidates: [{ content: { parts: [{ text: "" }] } }] } },
    ]);
    const provider = createGeminiProvider({
      config: {
        apiKey: "g",
        backend: "gemini-api",
        baseUrl: "https://generativelanguage.googleapis.com",
      },
    });

    const result = await provider.search({ query: "q", fetchImpl: fake.fetchImpl });
    expect(result.answer).toBe("");
    expect(result.citations).toEqual([]);
    expect(result.searchQueries).toEqual([]);
  });
});
