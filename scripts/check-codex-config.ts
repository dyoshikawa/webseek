import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseToml } from "smol-toml";
import * as z from "zod/mini";

const PINNED_SERENA_SOURCE =
  "git+https://github.com/oraios/serena@bcac0969fb8685783ea6d0f2642468fcc47e6395";
const EXPECTED_SERENA_ARGS = [
  "--from",
  PINNED_SERENA_SOURCE,
  "serena",
  "start-mcp-server",
  "--context",
  "ide-assistant",
  "--enable-web-dashboard",
  "false",
  "--project",
  ".",
] as const;

const codexConfigSchema = z.looseObject({
  default_permissions: z.literal(":danger-full-access"),
  approval_policy: z.literal("on-request"),
  approvals_reviewer: z.literal("auto_review"),
  mcp_servers: z.looseObject({
    serena: z.looseObject({
      type: z.literal("stdio"),
      command: z.literal("uvx"),
      args: z.array(z.string()),
    }),
  }),
});

function hasExactKeys({
  record,
  keys,
}: {
  record: Record<string, unknown>;
  keys: string[];
}): boolean {
  const actualKeys = Object.keys(record).toSorted();
  return actualKeys.length === keys.length && actualKeys.every((key, index) => key === keys[index]);
}

function hasExpectedSerenaArgs({ args }: { args: string[] }): boolean {
  return (
    args.length === EXPECTED_SERENA_ARGS.length &&
    args.every((argument, index) => argument === EXPECTED_SERENA_ARGS[index])
  );
}

const rulesyncMcpSchema = z.looseObject({
  mcpServers: z.looseObject({
    serena: z.looseObject({
      type: z.literal("stdio"),
      command: z.literal("uvx"),
      args: z.array(z.string()),
      env: z.looseObject({}),
    }),
  }),
});

const rulesyncPermissionsSchema = z.looseObject({
  permission: z.looseObject({
    edit: z.looseObject({ ".": z.literal("allow") }),
  }),
  codexcli: z.looseObject({
    approval_policy: z.literal("on-request"),
    base_permission_profile: z.literal(":danger-full-access"),
    approvals_reviewer: z.literal("auto_review"),
  }),
});

function hasExpectedCodexPermissions({
  data,
}: {
  data: z.infer<typeof codexConfigSchema>;
}): boolean {
  return (
    !("sandbox_mode" in data) && !("sandbox_workspace_write" in data) && !("permissions" in data)
  );
}

function hasExpectedCodexSerenaServer({
  server,
}: {
  server: z.infer<typeof codexConfigSchema>["mcp_servers"]["serena"];
}): boolean {
  return (
    hasExactKeys({ record: server, keys: ["args", "command", "type"] }) &&
    hasExpectedSerenaArgs({ args: server.args })
  );
}

function hasExpectedRulesyncSerenaServer({
  server,
}: {
  server: z.infer<typeof rulesyncMcpSchema>["mcpServers"]["serena"];
}): boolean {
  return (
    hasExactKeys({ record: server, keys: ["args", "command", "env", "type"] }) &&
    hasExactKeys({ record: server.env, keys: [] }) &&
    hasExpectedSerenaArgs({ args: server.args })
  );
}

function hasExpectedRulesyncPermissions({
  data,
}: {
  data: z.infer<typeof rulesyncPermissionsSchema>;
}): boolean {
  return (
    hasExactKeys({ record: data.permission, keys: ["edit"] }) &&
    hasExactKeys({ record: data.permission.edit, keys: ["."] }) &&
    hasExactKeys({
      record: data.codexcli,
      keys: ["approval_policy", "approvals_reviewer", "base_permission_profile"],
    })
  );
}

export function findCodexHardeningIssues({
  codexConfig,
  rulesyncMcpConfig,
  rulesyncPermissionsConfig,
}: {
  codexConfig: string;
  rulesyncMcpConfig: string;
  rulesyncPermissionsConfig: string;
}): string[] {
  const issues: string[] = [];

  try {
    const result = codexConfigSchema.safeParse(parseToml(codexConfig));
    if (!result.success || !hasExpectedCodexPermissions({ data: result.data })) {
      issues.push("Generated Codex permissions do not match the expected full-access policy");
    } else if (!hasExpectedCodexSerenaServer({ server: result.data.mcp_servers.serena })) {
      issues.push("Generated Codex MCP config does not use the pinned Serena source");
    }
  } catch {
    issues.push("Generated Codex config is not valid TOML");
  }

  try {
    const result = rulesyncMcpSchema.safeParse(JSON.parse(rulesyncMcpConfig));
    if (
      !result.success ||
      !hasExpectedRulesyncSerenaServer({ server: result.data.mcpServers.serena })
    ) {
      issues.push("Rulesync MCP source does not use the pinned Serena source");
    }
  } catch {
    issues.push("Rulesync MCP source is not valid JSON");
  }

  try {
    const result = rulesyncPermissionsSchema.safeParse(JSON.parse(rulesyncPermissionsConfig));
    if (!result.success || !hasExpectedRulesyncPermissions({ data: result.data })) {
      issues.push("Rulesync permissions source does not match the expected full-access policy");
    }
  } catch {
    issues.push("Rulesync permissions source is not valid JSON");
  }

  return issues;
}

function main(): void {
  const root = process.cwd();
  const issues = findCodexHardeningIssues({
    codexConfig: readFileSync(join(root, ".codex", "config.toml"), "utf8"),
    rulesyncMcpConfig: readFileSync(join(root, ".rulesync", "mcp.json"), "utf8"),
    rulesyncPermissionsConfig: readFileSync(join(root, ".rulesync", "permissions.json"), "utf8"),
  });

  if (issues.length === 0) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.error(`Codex configuration hardening check failed:\n${issues.join("\n")}`);
  process.exit(1);
}

const entryPointPath = process.argv[1];
if (entryPointPath && fileURLToPath(import.meta.url) === entryPointPath) {
  main();
}
