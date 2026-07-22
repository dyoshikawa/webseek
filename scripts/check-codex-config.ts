import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseToml } from "smol-toml";
import * as z from "zod/mini";

const PINNED_SERENA_SOURCE =
  "git+https://github.com/oraios/serena@bcac0969fb8685783ea6d0f2642468fcc47e6395";

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
        ":workspace_roots": z.looseObject({ ".": z.literal("write") }),
      }),
    }),
  }),
});

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
    if (!result.success) {
      issues.push("Generated Codex permissions are not workspace-bounded and human-reviewed");
    } else if (!result.data.mcp_servers.serena.args.includes(PINNED_SERENA_SOURCE)) {
      issues.push("Generated Codex MCP config does not use the pinned Serena source");
    }
  } catch {
    issues.push("Generated Codex config is not valid TOML");
  }

  try {
    const result = rulesyncMcpSchema.safeParse(JSON.parse(rulesyncMcpConfig));
    if (!result.success || !result.data.mcpServers.serena.args.includes(PINNED_SERENA_SOURCE)) {
      issues.push("Rulesync MCP source does not use the pinned Serena source");
    }
  } catch {
    issues.push("Rulesync MCP source is not valid JSON");
  }

  try {
    if (!rulesyncPermissionsSchema.safeParse(JSON.parse(rulesyncPermissionsConfig)).success) {
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
