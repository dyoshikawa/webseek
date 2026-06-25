import { describe, expect, it } from "vitest";

import { createFakeFetch } from "../test-utils/fake-fetch.js";
import { createWebSearchTool } from "./tools.js";

describe("web_search tool", () => {
  it("returns a normalized result as JSON text on success", async () => {
    const fake = createFakeFetch([
      { body: { items: [{ title: "T", link: "https://x.example", snippet: "s" }] } },
    ]);
    const tool = createWebSearchTool({
      env: { GOOGLE_API_KEY: "k", GOOGLE_CSE_CX: "cx" },
      fetchImpl: fake.fetchImpl,
    });

    const result = await tool.handler({ provider: "google", query: "q" });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");
    expect(parsed.provider).toBe("google");
    expect(parsed.results[0].url).toBe("https://x.example");
  });

  it("returns an error result when credentials are missing", async () => {
    const tool = createWebSearchTool({ env: {} });

    const result = await tool.handler({ provider: "openai", query: "q" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("OPENAI_API_KEY");
  });
});
