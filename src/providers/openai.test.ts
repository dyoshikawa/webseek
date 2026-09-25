import { describe, expect, it } from "vitest";

import { createFakeFetch } from "../test-utils/fake-fetch.js";
import { createOpenAIProvider } from "./openai.js";

const config = { apiKey: "sk-test", baseUrl: "https://api.openai.com" };

describe("openai provider", () => {
  it("extracts answer, citations, and search queries", async () => {
    const fake = createFakeFetch([
      {
        body: {
          output: [
            { type: "web_search_call", action: { query: "latest ts release" } },
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "TypeScript 6 is out.",
                  annotations: [
                    {
                      type: "url_citation",
                      url: "https://ts.dev",
                      title: "TS",
                      start_index: 0,
                      end_index: 10,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ]);
    const provider = createOpenAIProvider({ config });

    const result = await provider.search({ query: "typescript", fetchImpl: fake.fetchImpl });

    expect(result.provider).toBe("openai");
    expect(result.answer).toBe("TypeScript 6 is out.");
    expect(result.citations).toEqual([
      { url: "https://ts.dev", title: "TS", startIndex: 0, endIndex: 10 },
    ]);
    expect(result.searchQueries).toEqual(["latest ts release"]);

    const init = fake.requests[0]?.init;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(init?.method).toBe("POST");
    expect(headers?.authorization).toBe("Bearer sk-test");
    expect(JSON.parse(String(init?.body)).tools).toEqual([{ type: "web_search" }]);
  });

  it("parses a successful response that carries an explicit null error field", async () => {
    // The Responses API returns `"error": null` on success. A schema that only
    // accepts `undefined` (e.g. `.optional()`) rejects this and surfaces the
    // parse failure as a bogus HTTP 200 provider error. Guard against that.
    const fake = createFakeFetch([
      {
        body: {
          error: null,
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Hi!" }],
            },
          ],
        },
      },
    ]);
    const provider = createOpenAIProvider({ config });

    const result = await provider.search({ query: "hi", fetchImpl: fake.fetchImpl });

    expect(result.answer).toBe("Hi!");
    expect(result.citations).toEqual([]);
  });

  it("reports token usage, web search calls, and the estimated cost", async () => {
    const fake = createFakeFetch([
      {
        body: {
          model: "gpt-5.5-2026-04-23",
          output: [
            { type: "web_search_call", action: { type: "search", query: "a" } },
            { type: "web_search_call", action: { type: "search", query: "b" } },
            { type: "message", content: [{ type: "output_text", text: "Done." }] },
          ],
          usage: {
            input_tokens: 10_000,
            input_tokens_details: { cached_tokens: 2_000 },
            output_tokens: 1_000,
            total_tokens: 11_000,
          },
        },
      },
    ]);
    const provider = createOpenAIProvider({ config });

    const result = await provider.search({ query: "q", fetchImpl: fake.fetchImpl });

    expect(result.model).toBe("gpt-5.5-2026-04-23");
    expect(result.usage).toEqual({
      inputTokens: 10_000,
      cachedInputTokens: 2_000,
      outputTokens: 1_000,
      totalTokens: 11_000,
      searchCalls: 2,
    });
    expect(result.cost?.totalUsd).toBeCloseTo(0.091, 6);
  });

  it("leaves the cost unset for a model without a known price", async () => {
    const fake = createFakeFetch([
      { body: { model: "gpt-9", output: [], usage: { input_tokens: 5, output_tokens: 5 } } },
    ]);
    const provider = createOpenAIProvider({ config });

    const result = await provider.search({ query: "q", model: "gpt-9", fetchImpl: fake.fetchImpl });

    expect(result.usage?.inputTokens).toBe(5);
    expect(result.cost).toBeUndefined();
  });

  it("gives no cost when the response carries no usage", async () => {
    const fake = createFakeFetch([
      {
        body: {
          usage: null,
          output: [{ type: "web_search_call", action: { query: "a" } }],
        },
      },
    ]);
    const provider = createOpenAIProvider({ config });

    const result = await provider.search({ query: "q", fetchImpl: fake.fetchImpl });

    expect(result.usage).toEqual({
      inputTokens: undefined,
      cachedInputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      searchCalls: 1,
    });
    expect(result.cost).toBeUndefined();
  });

  it("maps 429 to a rate_limited error", async () => {
    const fake = createFakeFetch([{ status: 429, body: { error: { message: "slow down" } } }]);
    const provider = createOpenAIProvider({ config });

    await expect(provider.search({ query: "q", fetchImpl: fake.fetchImpl })).rejects.toMatchObject({
      code: "rate_limited",
    });
  });
});
