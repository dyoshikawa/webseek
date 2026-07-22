import { describe, expect, it } from "vitest";

import { findCodexHardeningIssues } from "./check-codex-config.js";

const pinnedSerenaSource =
  "git+https://github.com/oraios/serena@bcac0969fb8685783ea6d0f2642468fcc47e6395";

const hardenedCodexConfig = `
default_permissions = "rulesync"
approval_policy = "on-request"
approvals_reviewer = "user"

[mcp_servers.serena]
args = ["--from", "${pinnedSerenaSource}", "serena"]

[permissions.rulesync]
extends = ":workspace"

[permissions.rulesync.filesystem.":workspace_roots"]
"." = "write"
`;

const rulesyncMcpConfig = JSON.stringify({
  mcpServers: { serena: { args: ["--from", pinnedSerenaSource, "serena"] } },
});

const rulesyncPermissionsConfig = JSON.stringify({
  permission: { edit: { ".": "allow" } },
  codexcli: { base_permission_profile: ":workspace" },
});

function validate({
  codexConfig = hardenedCodexConfig,
  mcpConfig = rulesyncMcpConfig,
  permissionsConfig = rulesyncPermissionsConfig,
}: {
  codexConfig?: string;
  mcpConfig?: string;
  permissionsConfig?: string;
} = {}): string[] {
  return findCodexHardeningIssues({
    codexConfig,
    rulesyncMcpConfig: mcpConfig,
    rulesyncPermissionsConfig: permissionsConfig,
  });
}

describe("findCodexHardeningIssues", () => {
  it("accepts aligned Rulesync sources and generated Codex hardening", () => {
    expect(validate()).toEqual([]);
  });

  it("rejects a commented decoy beside an unsafe active reviewer", () => {
    const codexConfig = hardenedCodexConfig.replace(
      'approvals_reviewer = "user"',
      'approvals_reviewer = "auto_review"\n# approvals_reviewer = "user"',
    );

    expect(validate({ codexConfig })).toContain(
      "Generated Codex permissions are not workspace-bounded and human-reviewed",
    );
  });

  it("rejects workspace settings under the wrong profile", () => {
    const codexConfig = hardenedCodexConfig.replace(
      "[permissions.rulesync]",
      "[permissions.unselected]",
    );

    expect(validate({ codexConfig })).toContain(
      "Generated Codex permissions are not workspace-bounded and human-reviewed",
    );
  });

  it("rejects a floating Serena source in Rulesync", () => {
    const mcpConfig = rulesyncMcpConfig.replace(
      pinnedSerenaSource,
      "git+https://github.com/oraios/serena",
    );

    expect(validate({ mcpConfig })).toContain(
      "Rulesync MCP source does not use the pinned Serena source",
    );
  });

  it("rejects a Rulesync permission source that can regenerate unsafe output", () => {
    const permissionsConfig = rulesyncPermissionsConfig.replace('".":"allow"', '".":"deny"');

    expect(validate({ permissionsConfig })).toContain(
      "Rulesync permissions source is not workspace-bounded",
    );
  });
});
