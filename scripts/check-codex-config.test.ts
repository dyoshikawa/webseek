import { describe, expect, it } from "vitest";

import { findCodexHardeningIssues } from "./check-codex-config.js";

const pinnedSerenaSource =
  "git+https://github.com/oraios/serena@bcac0969fb8685783ea6d0f2642468fcc47e6395";
const serenaArgs = [
  "--from",
  pinnedSerenaSource,
  "serena",
  "start-mcp-server",
  "--context",
  "ide-assistant",
  "--enable-web-dashboard",
  "false",
  "--project",
  ".",
];

const hardenedCodexConfig = `
default_permissions = "rulesync"
approval_policy = "on-request"
approvals_reviewer = "user"

[mcp_servers.serena]
type = "stdio"
command = "uvx"
args = ${JSON.stringify(serenaArgs)}

[permissions.rulesync]
extends = ":workspace"

[permissions.rulesync.filesystem]
":minimal" = "read"

[permissions.rulesync.filesystem.":workspace_roots"]
"." = "write"
`;

const rulesyncMcpConfig = JSON.stringify({
  mcpServers: { serena: { type: "stdio", command: "uvx", args: serenaArgs, env: {} } },
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

  it("rejects a legacy full-access sandbox override", () => {
    const codexConfig = `sandbox_mode = "danger-full-access"\n${hardenedCodexConfig}`;

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

  it("rejects a pinned decoy argument after a floating active source", () => {
    const mcpConfig = JSON.stringify({
      mcpServers: {
        serena: {
          args: ["--from", "git+https://github.com/oraios/serena", "--with", pinnedSerenaSource],
        },
      },
    });

    expect(validate({ mcpConfig })).toContain(
      "Rulesync MCP source does not use the pinned Serena source",
    );
  });

  it("rejects an unexpected Serena executable", () => {
    const mcpConfig = JSON.stringify({
      mcpServers: {
        serena: { type: "stdio", command: "sh", args: serenaArgs, env: {} },
      },
    });

    expect(validate({ mcpConfig })).toContain(
      "Rulesync MCP source does not use the pinned Serena source",
    );
  });

  it("rejects a Serena working-directory override", () => {
    const mcpConfig = JSON.stringify({
      mcpServers: {
        serena: { type: "stdio", command: "uvx", args: serenaArgs, env: {}, cwd: "/" },
      },
    });

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

  it("rejects additional Rulesync permission grants", () => {
    const permissionsConfig = JSON.stringify({
      permission: { edit: { ".": "allow", "/": "allow" } },
      codexcli: { base_permission_profile: ":workspace" },
    });

    expect(validate({ permissionsConfig })).toContain(
      "Rulesync permissions source is not workspace-bounded",
    );
  });

  it("rejects additional generated network access", () => {
    const codexConfig = hardenedCodexConfig.replace(
      'extends = ":workspace"',
      'extends = ":workspace"\nnetwork = { enabled = true }',
    );

    expect(validate({ codexConfig })).toContain(
      "Generated Codex permissions are not workspace-bounded and human-reviewed",
    );
  });
});
