import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { apiCall } from "../shared/http.js";

const API_KEY = process.env.VAPI_API_KEY || "";
const BASE_URL = process.env.VAPI_BASE_URL || "https://api.vapi.ai";
const DEFAULT_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || "";
const DEFAULT_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || "";

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${API_KEY}` };
}

export const server = new Server(
  { name: "vapi-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "vapi_health",
      description: "Check VAPI API connectivity",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "vapi_list_assistants",
      description: "List all VAPI voice assistants",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "vapi_make_call",
      description: "Initiate an outbound phone call via VAPI",
      inputSchema: {
        type: "object" as const,
        properties: {
          phone_number: { type: "string", description: "Customer phone number in E.164 format" },
          assistant_id: { type: "string", description: "VAPI assistant ID (uses default if omitted)" },
          phone_number_id: { type: "string", description: "VAPI phone number ID (uses default if omitted)" },
          first_message: { type: "string", description: "Optional first message the assistant speaks" },
          metadata: { type: "object", description: "Optional metadata to attach to the call" },
        },
        required: ["phone_number"],
      },
    },
    {
      name: "vapi_get_call",
      description: "Get details of a specific VAPI call",
      inputSchema: {
        type: "object" as const,
        properties: { call_id: { type: "string", description: "The call ID" } },
        required: ["call_id"],
      },
    },
    {
      name: "vapi_list_calls",
      description: "List recent VAPI calls",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "Max number of calls to return (default 20)" },
        },
        required: [],
      },
    },
    {
      name: "vapi_get_transcript",
      description: "Get the transcript for a specific call",
      inputSchema: {
        type: "object" as const,
        properties: { call_id: { type: "string", description: "The call ID" } },
        required: ["call_id"],
      },
    },
    {
      name: "vapi_list_phone_numbers",
      description: "List all VAPI phone numbers",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "vapi_health": {
      const res = await apiCall(BASE_URL, "/assistant", { headers: authHeaders() });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ok: res.ok, status: res.status, message: res.ok ? "VAPI reachable" : "VAPI unreachable" },
              null,
              2
            ),
          },
        ],
      };
    }

    case "vapi_list_assistants": {
      const res = await apiCall(BASE_URL, "/assistant", { headers: authHeaders() });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "vapi_make_call": {
      const {
        phone_number,
        assistant_id,
        phone_number_id,
        first_message,
        metadata,
      } = args as {
        phone_number: string;
        assistant_id?: string;
        phone_number_id?: string;
        first_message?: string;
        metadata?: any;
      };

      const body: any = {
        phoneNumberId: phone_number_id || DEFAULT_PHONE_NUMBER_ID,
        assistantId: assistant_id || DEFAULT_ASSISTANT_ID,
        customer: { number: phone_number },
      };

      if (first_message) {
        body.assistantOverrides = { firstMessage: first_message };
      }
      if (metadata) {
        body.metadata = metadata;
      }

      const res = await apiCall(BASE_URL, "/call", {
        method: "POST",
        headers: authHeaders(),
        body,
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "vapi_get_call": {
      const { call_id } = args as { call_id: string };
      const res = await apiCall(BASE_URL, `/call/${call_id}`, { headers: authHeaders() });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "vapi_list_calls": {
      const { limit } = (args as { limit?: number }) || {};
      const query = limit ? `?limit=${limit}` : "";
      const res = await apiCall(BASE_URL, `/call${query}`, { headers: authHeaders() });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "vapi_get_transcript": {
      const { call_id } = args as { call_id: string };
      const res = await apiCall(BASE_URL, `/call/${call_id}`, { headers: authHeaders() });
      if (res.ok && res.data) {
        const transcript = (res.data as any).transcript || (res.data as any).messages || "No transcript available";
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, transcript }, null, 2) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "vapi_list_phone_numbers": {
      const res = await apiCall(BASE_URL, "/phone-number", { headers: authHeaders() });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const isMain = !process.env.MCP_SSE_MODE;
if (isMain) {
  const transport = new StdioServerTransport();
  server.connect(transport).catch(console.error);
}
