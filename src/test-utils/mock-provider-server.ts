/**
 * A local HTTP server that imitates the provider endpoints, so e2e tests can
 * exercise the real CLI/MCP binaries (spawned as child processes) without any
 * network access or API keys. Point a provider's base URL at this server via
 * the `WEBSEARCH_*_BASE_URL` environment variables.
 */

import { createServer, type Server } from "node:http";

export interface RecordedHttpRequest {
  method: string;
  path: string;
  body: string;
}

export interface MockProviderServer {
  url: string;
  requests: RecordedHttpRequest[];
  close: () => Promise<void>;
}

const GOOGLE_BODY = {
  items: [
    {
      title: "Mock Result",
      link: "https://example.com/mock",
      snippet: "A result from the mock provider server.",
      displayLink: "example.com",
    },
  ],
};

const OPENAI_BODY = {
  output: [
    { type: "web_search_call", action: { query: "mock search" } },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "Mock OpenAI answer.",
          annotations: [{ type: "url_citation", url: "https://src.example", title: "Source" }],
        },
      ],
    },
  ],
};

const GEMINI_BODY = {
  candidates: [
    {
      content: { parts: [{ text: "Mock Gemini answer." }] },
      groundingMetadata: {
        webSearchQueries: ["mock gemini query"],
        groundingChunks: [{ web: { uri: "https://grounding.example", title: "Grounding" } }],
      },
    },
  ],
};

function bodyForPath(pathname: string): unknown {
  if (pathname === "/customsearch/v1") {
    return GOOGLE_BODY;
  }
  if (pathname === "/v1/responses") {
    return OPENAI_BODY;
  }
  if (pathname.endsWith(":generateContent")) {
    return GEMINI_BODY;
  }
  return undefined;
}

export async function startMockProviderServer(): Promise<MockProviderServer> {
  const requests: RecordedHttpRequest[] = [];

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      requests.push({
        method: req.method ?? "GET",
        path: pathname,
        body: Buffer.concat(chunks).toString("utf8"),
      });

      const body = bodyForPath(pathname);
      res.setHeader("content-type", "application/json");
      if (body === undefined) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: { message: `no mock for ${pathname}` } }));
        return;
      }
      res.end(JSON.stringify(body));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
