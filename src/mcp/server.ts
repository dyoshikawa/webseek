/**
 * MCP server mode: exposes the `web_search` tool over the stdio transport so
 * MCP clients (editors, agents) can search the web through this tool.
 *
 * Diagnostics go to stderr only — stdout is reserved for the JSON-RPC stream.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { Logger } from "../utils/logger.js";
import { createWebSearchTool } from "./tools.js";

export interface StartMcpServerParams {
  version: string;
  logger: Logger;
}

export async function startMcpServer(params: StartMcpServerParams): Promise<void> {
  const server = new McpServer({ name: "webseek", version: params.version });

  const tool = createWebSearchTool();
  server.registerTool(tool.name, tool.config, tool.handler);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  params.logger.info("webseek MCP server started (stdio)");
}
