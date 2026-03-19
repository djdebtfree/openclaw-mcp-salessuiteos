import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

export function createSSEServer(mcpServer: Server, port: number) {
  const app = express();
  app.use(express.json());

  let transport: SSEServerTransport | null = null;

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: mcpServer.name, timestamp: new Date().toISOString() });
  });

  app.get("/sse", async (req, res) => {
    transport = new SSEServerTransport("/messages", res);
    await mcpServer.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    if (!transport) {
      res.status(400).json({ error: "No active SSE connection" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  app.listen(port, () => {
    console.log(`MCP SSE server listening on port ${port}`);
  });

  return app;
}
