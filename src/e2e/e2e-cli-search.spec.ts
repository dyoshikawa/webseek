import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type MockProviderServer,
  startMockProviderServer,
} from "../test-utils/mock-provider-server.js";
import { runCli } from "./e2e-helper.js";

describe("E2E: CLI search", () => {
  let mock: MockProviderServer;

  beforeAll(async () => {
    mock = await startMockProviderServer();
  });

  afterAll(async () => {
    await mock.close();
  });

  it("google: prints normalized SERP results as JSON", async () => {
    const { stdout, code } = await runCli({
      args: ["typescript", "--provider", "google", "--json"],
      env: {
        GOOGLE_API_KEY: "test-key",
        GOOGLE_CSE_CX: "test-cx",
        WEBSEEK_GOOGLE_BASE_URL: mock.url,
      },
    });
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.provider).toBe("google");
    expect(result.results[0].url).toBe("https://example.com/mock");
  });

  it("openai: prints a grounded answer with citations", async () => {
    const { stdout, code } = await runCli({
      args: ["latest news", "-p", "openai", "--json"],
      env: { OPENAI_API_KEY: "sk-test", WEBSEEK_OPENAI_BASE_URL: mock.url },
    });
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.answer).toBe("Mock OpenAI answer.");
    expect(result.citations[0].url).toBe("https://src.example");
    expect(result.usage).toEqual({
      inputTokens: 1_000,
      outputTokens: 100,
      totalTokens: 1_100,
      searchCalls: 1,
    });
    // gpt-5.5: 1k × $5 + 100 × $30 per 1M, plus one web search call at $10 per 1k.
    expect(result.cost.totalUsd).toBeCloseTo(0.018, 6);
  });

  it("gemini (gemini-api): prints a grounded answer", async () => {
    const { stdout, code } = await runCli({
      args: ["euro 2024", "-p", "gemini", "--json"],
      env: { GEMINI_API_KEY: "g-key", WEBSEEK_GEMINI_BASE_URL: mock.url },
    });
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.answer).toBe("Mock Gemini answer.");
    expect(result.usage).toEqual({
      inputTokens: 1_000,
      outputTokens: 100,
      totalTokens: 1_100,
      searchCalls: 1,
    });
    // gemini-2.5-flash: 1k × $0.30 + 100 × $2.50 per 1M, plus one grounded prompt at $35 per 1k.
    expect(result.cost.totalUsd).toBeCloseTo(0.03555, 6);
  });

  it("gemini (vertex-express): prints a grounded answer", async () => {
    const { stdout, code } = await runCli({
      args: ["euro 2024", "-p", "gemini", "--gemini-backend", "vertex-express", "--json"],
      env: { VERTEX_API_KEY: "v-key", WEBSEEK_VERTEX_BASE_URL: mock.url },
    });
    expect(code).toBe(0);
    expect(JSON.parse(stdout).answer).toBe("Mock Gemini answer.");
  });

  it("prints a clear error and a non-zero exit code when credentials are missing", async () => {
    const { stderr, code } = await runCli({
      args: ["q", "-p", "openai"],
      env: { OPENAI_API_KEY: "" },
    });
    expect(code).not.toBe(0);
    expect(stderr).toContain("OPENAI_API_KEY");
  });
});
