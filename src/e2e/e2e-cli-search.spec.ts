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
      args: ["search", "typescript", "--provider", "google", "--json"],
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
      args: ["search", "latest news", "-p", "openai", "--json"],
      env: { OPENAI_API_KEY: "sk-test", WEBSEEK_OPENAI_BASE_URL: mock.url },
    });
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.answer).toBe("Mock OpenAI answer.");
    expect(result.citations[0].url).toBe("https://src.example");
  });

  it("gemini (gemini-api): prints a grounded answer", async () => {
    const { stdout, code } = await runCli({
      args: ["search", "euro 2024", "-p", "gemini", "--json"],
      env: { GEMINI_API_KEY: "g-key", WEBSEEK_GEMINI_BASE_URL: mock.url },
    });
    expect(code).toBe(0);
    expect(JSON.parse(stdout).answer).toBe("Mock Gemini answer.");
  });

  it("gemini (vertex-express): prints a grounded answer", async () => {
    const { stdout, code } = await runCli({
      args: ["search", "euro 2024", "-p", "gemini", "--gemini-backend", "vertex-express", "--json"],
      env: { VERTEX_API_KEY: "v-key", WEBSEEK_VERTEX_BASE_URL: mock.url },
    });
    expect(code).toBe(0);
    expect(JSON.parse(stdout).answer).toBe("Mock Gemini answer.");
  });

  it("prints a clear error and a non-zero exit code when credentials are missing", async () => {
    const { stderr, code } = await runCli({
      args: ["search", "q", "-p", "openai"],
      env: { OPENAI_API_KEY: "" },
    });
    expect(code).not.toBe(0);
    expect(stderr).toContain("OPENAI_API_KEY");
  });
});
