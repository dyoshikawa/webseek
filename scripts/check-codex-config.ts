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
  default_permissions: z.literal("rulesync"),
  approval_policy: z.literal("on-request"),
  approvals_reviewer: z.literal("user"),
  mcp_servers: z.looseObject({
    serena: z.looseObject({ args: z.array(z.string()) }),
  }),
  permissions: z.looseObject({
    rulesync: z.looseObject({
      extends: z.literal(":workspace"),
      filesystem: z.looseObject({
        ":minimal": z.literal("read"),
        ":workspace_roots": z.looseObject({ ".": z.literal("write") }),
      }),
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
    serena: z.looseObject({ args: z.array(z.string()) }),
  }),
});

const rulesyncPermissionsSchema = z.looseObject({
  permission: z.looseObject({
    edit: z.looseObject({ ".": z.literal("allow") }),
  }),
  codexcli: z.looseObject({
    base_permission_profile: z.literal(":workspace"),
  }),
});

function hasHardenedCodexPermissions({
  data,
}: {
  data: z.infer<typeof codexConfigSchema>;
}): boolean {
  const profile = data.permissions.rulesync;
  const filesystem = profile.filesystem;

  return (
    hasExactKeys({ record: profile, keys: ["extends", "filesystem"] }) &&
    hasExactKeys({ record: filesystem, keys: [":minimal", ":workspace_roots"] }) &&
    hasExactKeys({ record: filesystem[":workspace_roots"], keys: ["."] })
  );
}

function hasHardenedRulesyncPermissions({
  data,
}: {
  data: z.infer<typeof rulesyncPermissionsSchema>;
}): boolean {
  return (
    hasExactKeys({ record: data.permission, keys: ["edit"] }) &&
    hasExactKeys({ record: data.permission.edit, keys: ["."] }) &&
    hasExactKeys({ record: data.codexcli, keys: ["base_permission_profile"] })
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
    if (!result.success || !hasHardenedCodexPermissions({ data: result.data })) {
      issues.push("Generated Codex permissions are not workspace-bounded and human-reviewed");
    } else if (!hasExpectedSerenaArgs({ args: result.data.mcp_servers.serena.args })) {
      issues.push("Generated Codex MCP config does not use the pinned Serena source");
    }
  } catch {
    issues.push("Generated Codex config is not valid TOML");
  }

  try {
    const result = rulesyncMcpSchema.safeParse(JSON.parse(rulesyncMcpConfig));
    if (!result.success || !hasExpectedSerenaArgs({ args: result.data.mcpServers.serena.args })) {
      issues.push("Rulesync MCP source does not use the pinned Serena source");
    }
  } catch {
    issues.push("Rulesync MCP source is not valid JSON");
  }

  try {
    const result = rulesyncPermissionsSchema.safeParse(JSON.parse(rulesyncPermissionsConfig));
    if (!result.success || !hasHardenedRulesyncPermissions({ data: result.data })) {
      issues.push("Rulesync permissions source is not workspace-bounded");
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
