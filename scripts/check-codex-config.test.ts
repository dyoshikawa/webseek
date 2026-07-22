import { describe, expect, it } from "vitest";

import { findMissingCodexHardening } from "./check-codex-config.js";

const hardenedConfig = `
default_permissions = "rulesync"
approval_policy = "on-request"
approvals_reviewer = "user"

[permissions.rulesync]
extends = ":workspace"

[permissions.rulesync.filesystem.":workspace_roots"]
"." = "write"
`;

describe("findMissingCodexHardening", () => {
  it("accepts the generated workspace profile with human-reviewed escalation", () => {
    expect(findMissingCodexHardening({ config: hardenedConfig })).toEqual([]);
  });

  it("reports a missing human approval reviewer", () => {
    const config = hardenedConfig.replace('approvals_reviewer = "user"', "");

    expect(findMissingCodexHardening({ config })).toContain('approvals_reviewer = "user"');
  });
});
