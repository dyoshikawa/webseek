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
