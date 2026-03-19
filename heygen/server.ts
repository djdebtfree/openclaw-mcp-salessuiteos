import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { apiCall } from "../shared/http.js";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || "";
const HEYGEN_BASE_URL = process.env.HEYGEN_BASE_URL || "https://api.heygen.com";
const LIVEAVATAR_API_KEY = process.env.LIVEAVATAR_API_KEY || "";
const LIVEAVATAR_BASE_URL = process.env.LIVEAVATAR_BASE_URL || "https://api.liveavatar.com/v1";

function heygenHeaders(): Record<string, string> {
  return { "X-API-KEY": HEYGEN_API_KEY };
}

function liveAvatarHeaders(): Record<string, string> {
  return { "X-API-KEY": LIVEAVATAR_API_KEY || HEYGEN_API_KEY };
}

export const server = new Server(
  { name: "heygen-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "heygen_health",
      description: "Check HeyGen API health and remaining quota",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "heygen_list_avatars",
      description: "List available HeyGen avatars",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "heygen_list_voices",
      description: "List available HeyGen voices",
      inputSchema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "heygen_generate_video",
      description: "Generate an avatar video with HeyGen",
      inputSchema: {
        type: "object" as const,
        properties: {
          avatar_id: { type: "string", description: "Avatar ID to use" },
          voice_id: { type: "string", description: "Voice ID to use" },
          script: { type: "string", description: "Text script for the avatar to speak" },
          title: { type: "string", description: "Optional video title" },
        },
        required: ["avatar_id", "voice_id", "script"],
      },
    },
    {
      name: "heygen_video_agent",
      description: "Create an interactive video agent session",
      inputSchema: {
        type: "object" as const,
        properties: {
          avatar_id: { type: "string", description: "Avatar ID" },
          voice_id: { type: "string", description: "Voice ID" },
          system_prompt: { type: "string", description: "System prompt for the agent" },
          knowledge_base_id: { type: "string", description: "Optional knowledge base ID" },
        },
        required: ["avatar_id", "voice_id"],
      },
    },
    {
      name: "heygen_check_video_status",
      description: "Check the status of a generated video",
      inputSchema: {
        type: "object" as const,
        properties: { video_id: { type: "string", description: "The video ID to check" } },
        required: ["video_id"],
      },
    },
    {
      name: "heygen_create_liveavatar_session",
      description: "Create a LiveAvatar streaming session (tries LiveAvatar API, falls back to HeyGen streaming)",
      inputSchema: {
        type: "object" as const,
        properties: {
          avatar_id: { type: "string", description: "Avatar ID for the session" },
          voice_id: { type: "string", description: "Optional voice ID" },
          quality: { type: "string", description: "Stream quality: low, medium, high (default medium)" },
        },
        required: ["avatar_id"],
      },
    },
    {
      name: "heygen_liveavatar_speak",
      description: "Make a LiveAvatar speak text in an active session",
      inputSchema: {
        type: "object" as const,
        properties: {
          session_id: { type: "string", description: "Active session ID" },
          text: { type: "string", description: "Text for the avatar to speak" },
        },
        required: ["session_id", "text"],
      },
    },
    {
      name: "heygen_close_session",
      description: "Close a LiveAvatar streaming session",
      inputSchema: {
        type: "object" as const,
        properties: { session_id: { type: "string", description: "Session ID to close" } },
        required: ["session_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "heygen_health": {
      const res = await apiCall(HEYGEN_BASE_URL, "/v1/user/remaining_quota", {
        headers: heygenHeaders(),
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "heygen_list_avatars": {
      const res = await apiCall(HEYGEN_BASE_URL, "/v2/avatars", {
        headers: heygenHeaders(),
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "heygen_list_voices": {
      const res = await apiCall(HEYGEN_BASE_URL, "/v2/voices", {
        headers: heygenHeaders(),
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "heygen_generate_video": {
      const { avatar_id, voice_id, script, title } = args as {
        avatar_id: string;
        voice_id: string;
        script: string;
        title?: string;
      };
      const res = await apiCall(HEYGEN_BASE_URL, "/v2/video/generate", {
        method: "POST",
        headers: heygenHeaders(),
        body: {
          video_inputs: [
            {
              character: { type: "avatar", avatar_id },
              voice: { type: "text", voice_id, input_text: script },
            },
          ],
          ...(title ? { title } : {}),
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "heygen_video_agent": {
      const { avatar_id, voice_id, system_prompt, knowledge_base_id } = args as {
        avatar_id: string;
        voice_id: string;
        system_prompt?: string;
        knowledge_base_id?: string;
      };
      const res = await apiCall(HEYGEN_BASE_URL, "/v1/interactive_avatar.new", {
        method: "POST",
        headers: heygenHeaders(),
        body: {
          avatar_id,
          voice_id,
          ...(system_prompt ? { system_prompt } : {}),
          ...(knowledge_base_id ? { knowledge_base_id } : {}),
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "heygen_check_video_status": {
      const { video_id } = args as { video_id: string };
      const res = await apiCall(HEYGEN_BASE_URL, `/v1/video_status.get?video_id=${video_id}`, {
        headers: heygenHeaders(),
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    case "heygen_create_liveavatar_session": {
      const { avatar_id, voice_id, quality } = args as {
        avatar_id: string;
        voice_id?: string;
        quality?: string;
      };

      // Try LiveAvatar API first
      const liveRes = await apiCall(LIVEAVATAR_BASE_URL, "/sessions", {
        method: "POST",
        headers: liveAvatarHeaders(),
        body: {
          avatar_id,
          ...(voice_id ? { voice_id } : {}),
          quality: quality || "medium",
        },
      });

      if (liveRes.ok) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ ...liveRes, source: "liveavatar" }, null, 2) },
          ],
        };
      }

      // Fallback to HeyGen streaming API
      const heygenRes = await apiCall(HEYGEN_BASE_URL, "/v1/streaming.new", {
        method: "POST",
        headers: heygenHeaders(),
        body: {
          avatar_id,
          ...(voice_id ? { voice_id } : {}),
          quality: quality || "medium",
        },
      });
      return {
        content: [
          { type: "text", text: JSON.stringify({ ...heygenRes, source: "heygen_streaming" }, null, 2) },
        ],
      };
    }

    case "heygen_liveavatar_speak": {
      const { session_id, text } = args as { session_id: string; text: string };

      // Try LiveAvatar first
      const liveRes = await apiCall(LIVEAVATAR_BASE_URL, `/sessions/${session_id}/speak`, {
        method: "POST",
        headers: liveAvatarHeaders(),
        body: { text },
      });

      if (liveRes.ok) {
        return { content: [{ type: "text", text: JSON.stringify(liveRes, null, 2) }] };
      }

      // Fallback to HeyGen streaming
      const heygenRes = await apiCall(HEYGEN_BASE_URL, "/v1/streaming.task", {
        method: "POST",
        headers: heygenHeaders(),
        body: { session_id, text },
      });
      return { content: [{ type: "text", text: JSON.stringify(heygenRes, null, 2) }] };
    }

    case "heygen_close_session": {
      const { session_id } = args as { session_id: string };

      // Try LiveAvatar first
      const liveRes = await apiCall(LIVEAVATAR_BASE_URL, `/sessions/${session_id}`, {
        method: "DELETE",
        headers: liveAvatarHeaders(),
      });

      if (liveRes.ok) {
        return { content: [{ type: "text", text: JSON.stringify(liveRes, null, 2) }] };
      }

      // Fallback to HeyGen streaming
      const heygenRes = await apiCall(HEYGEN_BASE_URL, "/v1/streaming.stop", {
        method: "POST",
        headers: heygenHeaders(),
        body: { session_id },
      });
      return { content: [{ type: "text", text: JSON.stringify(heygenRes, null, 2) }] };
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
