#!/usr/bin/env node
/**
 * webseek CLI entry point.
 *
 * Two modes:
 *   webseek <query> --provider <name>   run a one-off web search (root command)
 *   webseek mcp                         start the MCP server (stdio)
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { Command } from "commander";

import { formatError } from "../utils/error.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerSearchCommand } from "./commands/search.js";

function readPackageVersion(dir: string): string | undefined {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      name?: string;
      version?: string;
    };
    return pkg.name === "webseek" ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

function getVersion(): string {
  let dir = import.meta.dirname;
  for (let depth = 0; depth < 6; depth += 1) {
    const version = readPackageVersion(dir);
    if (version) {
      return version;
    }
    dir = dirname(dir);
  }
  return "0.0.0";
}

function buildProgram(): Command {
  const program = new Command();
  const version = getVersion();

  program
    .name("webseek")
    .description("Unified multi-provider web search (CLI + MCP server)")
    .version(version, "-v, --version", "Show version");

  registerSearchCommand(program);
  registerMcpCommand({ program, version });

  return program;
}

async function main(): Promise<void> {
  await buildProgram().parseAsync(process.argv);
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
});
