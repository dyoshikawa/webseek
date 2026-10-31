/**
 * `webseek mcp` — start the MCP server over stdio.
 */

import type { Command } from "commander";

import { startMcpServer } from "../../mcp/server.js";
import { wrapCommand } from "../wrap-command.js";

export function registerMcpCommand(params: { program: Command; version: string }): void {
  params.program
    .command("mcp")
    .description("Start the MCP server (stdio) exposing the web_search tool")
    .action(
      wrapCommand(async ({ logger }) => {
        await startMcpServer({ version: params.version, logger });
      }),
    );
}
