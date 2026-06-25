import { describe, expect, it } from "vitest";

import { runCli } from "./e2e-helper.js";

describe("E2E: version", () => {
  it("prints a semver with --version", async () => {
    const { stdout, code } = await runCli({ args: ["--version"] });
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("lists the search and mcp commands in --help", async () => {
    const { stdout, code } = await runCli({ args: ["--help"] });
    expect(code).toBe(0);
    expect(stdout).toContain("search");
    expect(stdout).toContain("mcp");
  });
});
