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

const expectedCodexConfig = `
default_permissions = ":danger-full-access"
approval_policy = "on-request"
approvals_reviewer = "auto_review"

[mcp_servers.serena]
type = "stdio"
command = "uvx"
args = ${JSON.stringify(serenaArgs)}

`;

const rulesyncMcpConfig = JSON.stringify({
  mcpServers: { serena: { type: "stdio", command: "uvx", args: serenaArgs, env: {} } },
});

const rulesyncPermissionsConfig = JSON.stringify({
  permission: { edit: { ".": "allow" } },
  codexcli: {
    approval_policy: "on-request",
    base_permission_profile: ":danger-full-access",
    approvals_reviewer: "auto_review",
  },
});

function validate({
  codexConfig = expectedCodexConfig,
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
  it("accepts aligned Rulesync sources and generated Codex permissions", () => {
    expect(validate()).toEqual([]);
  });

  it("rejects a commented decoy beside an unexpected active reviewer", () => {
    const codexConfig = expectedCodexConfig.replace(
      'approvals_reviewer = "auto_review"',
      'approvals_reviewer = "user"\n# approvals_reviewer = "auto_review"',
    );

    expect(validate({ codexConfig })).toContain(
      "Generated Codex permissions do not match the expected full-access policy",
    );
  });

  it("rejects an unexpected generated permissions profile", () => {
    const codexConfig = `${expectedCodexConfig}\n[permissions.unselected]\nextends = ":workspace"`;

    expect(validate({ codexConfig })).toContain(
      "Generated Codex permissions do not match the expected full-access policy",
    );
  });

  it("rejects a legacy full-access sandbox override", () => {
    const codexConfig = `sandbox_mode = "danger-full-access"\n${expectedCodexConfig}`;

    expect(validate({ codexConfig })).toContain(
      "Generated Codex permissions do not match the expected full-access policy",
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
      "Rulesync permissions source does not match the expected full-access policy",
    );
  });

  it("rejects additional Rulesync permission grants", () => {
    const permissionsConfig = JSON.stringify({
      permission: { edit: { ".": "allow", "/": "allow" } },
      codexcli: {
        approval_policy: "on-request",
        base_permission_profile: ":danger-full-access",
        approvals_reviewer: "auto_review",
      },
    });

    expect(validate({ permissionsConfig })).toContain(
      "Rulesync permissions source does not match the expected full-access policy",
    );
  });

  it("rejects a legacy generated workspace permissions profile", () => {
    const codexConfig = `${expectedCodexConfig}\n[permissions.rulesync]\nextends = ":workspace"`;

    expect(validate({ codexConfig })).toContain(
      "Generated Codex permissions do not match the expected full-access policy",
    );
  });
});
