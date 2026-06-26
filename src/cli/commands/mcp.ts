/**
 * `webseek mcp` — start the MCP server over stdio.
 */

import type { Command } from "commander";

import { startMcpServer } from "../../mcp/server.js";
import type { Logger } from "../../utils/logger.js";
import { wrapCommand } from "../wrap-command.js";

export async function runMcpCommand(params: { logger: Logger; version: string }): Promise<void> {
  await startMcpServer({ version: params.version, logger: params.logger });
}

export function registerMcpCommand(params: { program: Command; version: string }): void {
  params.program
    .command("mcp")
    .description("Start the MCP server (stdio) exposing the web_search tool")
    .action(
      wrapCommand(async ({ logger }) => {
        await runMcpCommand({ logger, version: params.version });
      }),
    );
}
