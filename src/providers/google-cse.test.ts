import { describe, expect, it } from "vitest";

import { createFakeFetch } from "../test-utils/fake-fetch.js";
import { createGoogleCseProvider } from "./google-cse.js";

const config = { apiKey: "test-key", cx: "test-cx", baseUrl: "https://www.googleapis.com" };

const buildPage = (n: number) => ({
  body: { items: Array.from({ length: 10 }, (_, i) => ({ link: `https://e/${n}-${i}` })) },
});

describe("google-cse provider", () => {
  it("normalizes SERP items and sends key/cx/q", async () => {
    const fake = createFakeFetch([
      {
        body: {
          items: [
            {
              title: "Example",
              link: "https://example.com",
              snippet: "An example.",
              displayLink: "example.com",
            },
            { title: "Second", link: "https://second.com", snippet: "Another." },
          ],
        },
      },
    ]);
    const provider = createGoogleCseProvider({ config });

    const result = await provider.search({ query: "hello world", fetchImpl: fake.fetchImpl });

    expect(result.provider).toBe("google");
    expect(result.query).toBe("hello world");
    expect(result.results).toEqual([
      {
        title: "Example",
        url: "https://example.com",
        snippet: "An example.",
        displayLink: "example.com",
      },
      { title: "Second", url: "https://second.com", snippet: "Another.", displayLink: undefined },
    ]);
    expect(result.citations).toEqual([]);

    const url = new URL(fake.requests[0]?.url ?? "");
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(url.searchParams.get("cx")).toBe("test-cx");
    expect(url.searchParams.get("q")).toBe("hello world");
  });

  it("paginates to satisfy maxResults beyond a single page", async () => {
    const fake = createFakeFetch([buildPage(1), buildPage(2)]);
    const provider = createGoogleCseProvider({ config });

    const result = await provider.search({ query: "q", maxResults: 15, fetchImpl: fake.fetchImpl });

    expect(result.results).toHaveLength(15);
    expect(fake.requests).toHaveLength(2);
    expect(new URL(fake.requests[1]?.url ?? "").searchParams.get("start")).toBe("11");
  });

  it("maps auth failures to an auth_failed error", async () => {
    const fake = createFakeFetch([{ status: 403, body: { error: { message: "Forbidden" } } }]);
    const provider = createGoogleCseProvider({ config });

    await expect(provider.search({ query: "q", fetchImpl: fake.fetchImpl })).rejects.toMatchObject({
      code: "auth_failed",
    });
  });
});
