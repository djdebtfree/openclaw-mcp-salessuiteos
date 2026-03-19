import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { apiCall } from "../shared/http.js";

const API_KEY = process.env.AUDIENCELAB_API_KEY || "";
const BASE_URL = process.env.AUDIENCELAB_BASE_URL || "https://api.audiencelab.io";

function authHeaders(): Record<string, string> {
  return { "x-api-key": API_KEY };
}

export const server = new Server(
  { name: "audiencelab-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "audiencelab_health",
      description: "Check Audience Lab API connection and return total audience count",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "audiencelab_list_audiences",
      description: "List all Audience Lab audiences with id, name, and total_records",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "audiencelab_get_audience",
      description: "Get audience details and paginated lead records by audience ID",
      inputSchema: {
        type: "object" as const,
        properties: {
          audience_id: { type: "string", description: "The audience ID" },
          page: { type: "number", description: "Page number (default 1)" },
          page_size: { type: "number", description: "Records per page (default 100)" },
        },
        required: ["audience_id"],
      },
    },
    {
      name: "audiencelab_search_leads",
      description:
        "Search leads within an audience with filters: state, has_email, has_phone, not_dnc. Fetches a page of leads and filters client-side.",
      inputSchema: {
        type: "object" as const,
        properties: {
          audience_id: { type: "string", description: "The audience ID to search" },
          page: { type: "number", description: "Page number (default 1)" },
          page_size: { type: "number", description: "Records per page (default 100)" },
          state: { type: "string", description: "Filter by US state (e.g. 'TX', 'CA')" },
          has_email: {
            type: "boolean",
            description: "Only return leads with at least one email",
          },
          has_phone: {
            type: "boolean",
            description: "Only return leads with a direct or mobile number",
          },
          not_dnc: {
            type: "boolean",
            description: "Exclude leads where DIRECT_NUMBER_DNC=Y or MOBILE_PHONE_DNC=Y",
          },
        },
        required: ["audience_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "audiencelab_health": {
      const res = await apiCall(BASE_URL, "/audiences", { headers: authHeaders() });
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `API error: ${res.status} — ${res.error || JSON.stringify(res.data)}` }],
        };
      }
      const audiences = Array.isArray(res.data) ? res.data : res.data?.audiences || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { status: "ok", audience_count: audiences.length },
              null,
              2
            ),
          },
        ],
      };
    }

    case "audiencelab_list_audiences": {
      const res = await apiCall(BASE_URL, "/audiences", { headers: authHeaders() });
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `API error: ${res.status} — ${res.error || JSON.stringify(res.data)}` }],
        };
      }
      const audiences = Array.isArray(res.data) ? res.data : res.data?.audiences || [];
      const summary = audiences.map((a: any) => ({
        id: a.id,
        name: a.name,
        total_records: a.total_records ?? null,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    }

    case "audiencelab_get_audience": {
      const { audience_id, page = 1, page_size = 100 } = args as {
        audience_id: string;
        page?: number;
        page_size?: number;
      };
      const res = await apiCall(
        BASE_URL,
        `/audiences/${audience_id}?page=${page}&page_size=${page_size}`,
        { headers: authHeaders() }
      );
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "audiencelab_search_leads": {
      const {
        audience_id,
        page = 1,
        page_size = 100,
        state,
        has_email,
        has_phone,
        not_dnc,
      } = args as {
        audience_id: string;
        page?: number;
        page_size?: number;
        state?: string;
        has_email?: boolean;
        has_phone?: boolean;
        not_dnc?: boolean;
      };

      const res = await apiCall(
        BASE_URL,
        `/audiences/${audience_id}?page=${page}&page_size=${page_size}`,
        { headers: authHeaders() }
      );

      if (!res.ok) {
        return {
          content: [{ type: "text", text: `API error: ${res.status} — ${res.error || JSON.stringify(res.data)}` }],
        };
      }

      let leads: any[] = res.data?.data || [];

      if (state) {
        const st = state.toUpperCase();
        leads = leads.filter((l: any) => (l.STATE || "").toUpperCase() === st);
      }

      if (has_email) {
        leads = leads.filter(
          (l: any) =>
            (l.PERSONAL_EMAILS && l.PERSONAL_EMAILS.length > 0) ||
            l.BUSINESS_EMAIL ||
            (l.BUSINESS_VERIFIED_EMAILS && l.BUSINESS_VERIFIED_EMAILS.length > 0)
        );
      }

      if (has_phone) {
        leads = leads.filter((l: any) => l.DIRECT_NUMBER || l.MOBILE_PHONE);
      }

      if (not_dnc) {
        leads = leads.filter(
          (l: any) =>
            (l.DIRECT_NUMBER_DNC || "").toUpperCase() !== "Y" &&
            (l.MOBILE_PHONE_DNC || "").toUpperCase() !== "Y"
        );
      }

      const result = {
        total_records: res.data?.total_records,
        page: res.data?.page,
        page_size: res.data?.page_size,
        total_pages: res.data?.total_pages,
        filtered_count: leads.length,
        filters_applied: {
          ...(state ? { state } : {}),
          ...(has_email ? { has_email } : {}),
          ...(has_phone ? { has_phone } : {}),
          ...(not_dnc ? { not_dnc } : {}),
        },
        data: leads,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
