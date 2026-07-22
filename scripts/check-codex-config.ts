import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_HARDENING = [
  'default_permissions = "rulesync"',
  'approval_policy = "on-request"',
  'approvals_reviewer = "user"',
  "[permissions.rulesync]",
  'extends = ":workspace"',
  '[permissions.rulesync.filesystem.":workspace_roots"]',
  '"." = "write"',
] as const;

export function findMissingCodexHardening({ config }: { config: string }): string[] {
  return REQUIRED_HARDENING.filter((setting) => !config.includes(setting));
}

function main(): void {
  const configPath = join(process.cwd(), ".codex", "config.toml");
  const missing = findMissingCodexHardening({ config: readFileSync(configPath, "utf8") });

  if (missing.length === 0) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.error(
    `Generated Codex configuration is missing required hardening:\n${missing.map((setting) => `- ${setting}`).join("\n")}`,
  );
  process.exit(1);
}

const entryPointPath = process.argv[1];
if (entryPointPath && fileURLToPath(import.meta.url) === entryPointPath) {
  main();
}
