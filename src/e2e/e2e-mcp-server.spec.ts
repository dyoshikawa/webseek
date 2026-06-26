import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type MockProviderServer,
  startMockProviderServer,
} from "../test-utils/mock-provider-server.js";
import { cleanEnv, webseekArgs, webseekCmd } from "./e2e-helper.js";

describe("E2E: MCP server", () => {
  let mock: MockProviderServer;
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    mock = await startMockProviderServer();
    transport = new StdioClientTransport({
      command: webseekCmd,
      args: [...webseekArgs, "mcp"],
      env: cleanEnv({ GEMINI_API_KEY: "g-key", WEBSEEK_GEMINI_BASE_URL: mock.url }),
    });
    client = new Client({ name: "webseek-e2e", version: "0.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    await mock.close();
  });

  it("exposes the web_search tool", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain("web_search");
  });

  it("runs a search through the web_search tool", async () => {
    const result = await client.callTool({
      name: "web_search",
      arguments: { provider: "gemini", query: "who won euro 2024" },
    });

    const content = result.content as { type: string; text: string }[];
    expect(content[0]?.type).toBe("text");
    const parsed = JSON.parse(content[0]?.text ?? "{}");
    expect(parsed.provider).toBe("gemini");
    expect(parsed.answer).toBe("Mock Gemini answer.");
  });

  it("reports a tool error when credentials are missing", async () => {
    const result = await client.callTool({
      name: "web_search",
      arguments: { provider: "openai", query: "q" },
    });
    expect(result.isError).toBe(true);
    const content = result.content as { type: string; text: string }[];
    expect(content[0]?.text).toContain("OPENAI_API_KEY");
  });
});
