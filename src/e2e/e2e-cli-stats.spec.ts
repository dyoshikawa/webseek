import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type MockProviderServer,
  startMockProviderServer,
} from "../test-utils/mock-provider-server.js";
import { runCli } from "./e2e-helper.js";

describe("E2E: CLI stats", () => {
  let mock: MockProviderServer;
  let dataDir: string;

  beforeAll(async () => {
    mock = await startMockProviderServer();
    dataDir = await mkdtemp(join(tmpdir(), "webseek-stats-"));
  });

  afterAll(async () => {
    await mock.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("records each search and totals them", async () => {
    const env = { WEBSEEK_DATA_DIR: dataDir };

    const empty = await runCli({ args: ["stats"], env });
    expect(empty.code).toBe(0);
    expect(empty.stdout).toContain("no searches in this range");

    for (let i = 0; i < 2; i += 1) {
      const search = await runCli({
        args: ["latest news", "-p", "openai"],
        env: { ...env, OPENAI_API_KEY: "sk-test", WEBSEEK_OPENAI_BASE_URL: mock.url },
      });
      expect(search.code).toBe(0);
    }
    const google = await runCli({
      args: ["typescript", "-p", "google"],
      env: {
        ...env,
        GOOGLE_API_KEY: "test-key",
        GOOGLE_CSE_CX: "test-cx",
        WEBSEEK_GOOGLE_BASE_URL: mock.url,
      },
    });
    expect(google.code).toBe(0);

    const log = await readFile(join(dataDir, "usage.jsonl"), "utf8");
    expect(log.trim().split("\n")).toHaveLength(3);
    expect(log).not.toContain("latest news");

    const { stdout, code } = await runCli({ args: ["stats", "--json"], env });
    expect(code).toBe(0);
    const stats = JSON.parse(stdout);
    expect(stats.searches).toBe(3);
    expect(stats.tokens.total).toBe(2_200);
    // Two gpt-5.5 searches at $0.018 each plus one Custom Search request at $0.005.
    expect(stats.cost.totalUsd).toBeCloseTo(0.041, 6);
    expect(stats.models[0]).toMatchObject({ provider: "openai", model: "gpt-5.5", searches: 2 });

    const filtered = await runCli({ args: ["stats", "-p", "google", "--models"], env });
    expect(filtered.stdout).toContain("google");
    expect(filtered.stdout).not.toContain("gpt-5.5");
  });

  it("skips logging when WEBSEEK_USAGE_LOG=off", async () => {
    const dir = await mkdtemp(join(tmpdir(), "webseek-stats-off-"));
    const search = await runCli({
      args: ["latest news", "-p", "openai"],
      env: {
        WEBSEEK_DATA_DIR: dir,
        WEBSEEK_USAGE_LOG: "off",
        OPENAI_API_KEY: "sk-test",
        WEBSEEK_OPENAI_BASE_URL: mock.url,
      },
    });
    expect(search.code).toBe(0);
    const { stdout } = await runCli({ args: ["stats", "--json"], env: { WEBSEEK_DATA_DIR: dir } });
    expect(JSON.parse(stdout).searches).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });
});
