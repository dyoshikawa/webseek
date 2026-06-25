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

  it("maps 429 to a rate_limited error", async () => {
    const fake = createFakeFetch([{ status: 429, body: { error: { message: "slow down" } } }]);
    const provider = createOpenAIProvider({ config });

    await expect(provider.search({ query: "q", fetchImpl: fake.fetchImpl })).rejects.toMatchObject({
      code: "rate_limited",
    });
  });
});
