import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { apiCall } from "../shared/http.js";

const API_KEY = process.env.MAYBETECH_API_KEY || "";
const BASE_URL = process.env.MAYBETECH_API_URL || "https://api.maybetech.com/v1";

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${API_KEY}` };
}

export const server = new Server(
  { name: "maybetech-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "maybetech_health",
      description: "Check MaybeTech API health status",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "maybetech_list_agents",
      description: "List all MaybeTech AI agents",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "maybetech_get_agent",
      description: "Get a specific MaybeTech agent by ID",
      inputSchema: {
        type: "object" as const,
        properties: { agent_id: { type: "string", description: "The agent ID" } },
        required: ["agent_id"],
      },
    },
    {
      name: "maybetech_create_conversation",
      description: "Create a new conversation with a MaybeTech agent",
      inputSchema: {
        type: "object" as const,
        properties: {
          agent_id: { type: "string", description: "The agent ID" },
          metadata: { type: "object", description: "Optional metadata for the conversation" },
        },
        required: ["agent_id"],
      },
    },
    {
      name: "maybetech_get_conversation",
      description: "Get a conversation by ID",
      inputSchema: {
        type: "object" as const,
        properties: { conversation_id: { type: "string", description: "The conversation ID" } },
        required: ["conversation_id"],
      },
    },
    {
      name: "maybetech_invoke_agent",
      description: "Invoke a MaybeTech agent with a message",
      inputSchema: {
        type: "object" as const,
        properties: {
          agent_id: { type: "string", description: "The agent ID to invoke" },
          message: { type: "string", description: "The message to send" },
          conversation_id: { type: "string", description: "Optional conversation ID for context" },
          metadata: { type: "object", description: "Optional metadata" },
        },
        required: ["agent_id", "message"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "maybetech_health": {
      const res = await apiCall(BASE_URL, "/health", { headers: authHeaders() });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "maybetech_list_agents": {
      const res = await apiCall(BASE_URL, "/agents", { headers: authHeaders() });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "maybetech_get_agent": {
      const { agent_id } = args as { agent_id: string };
      const res = await apiCall(BASE_URL, `/agents/${agent_id}`, { headers: authHeaders() });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "maybetech_create_conversation": {
      const { agent_id, metadata } = args as { agent_id: string; metadata?: any };
      const res = await apiCall(BASE_URL, "/conversations", {
        method: "POST",
        headers: authHeaders(),
        body: { agent_id, ...(metadata ? { metadata } : {}) },
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "maybetech_get_conversation": {
      const { conversation_id } = args as { conversation_id: string };
      const res = await apiCall(BASE_URL, `/conversations/${conversation_id}`, {
        headers: authHeaders(),
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "maybetech_invoke_agent": {
      const { agent_id, message, conversation_id, metadata } = args as {
        agent_id: string;
        message: string;
        conversation_id?: string;
        metadata?: any;
      };
      const res = await apiCall(BASE_URL, `/agents/${agent_id}/invoke`, {
        method: "POST",
        headers: authHeaders(),
        body: {
          message,
          ...(conversation_id ? { conversation_id } : {}),
          ...(metadata ? { metadata } : {}),
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Run stdio transport if this is the main module
const isMain = !process.env.MCP_SSE_MODE;
if (isMain) {
  const transport = new StdioServerTransport();
  server.connect(transport).catch(console.error);
}
