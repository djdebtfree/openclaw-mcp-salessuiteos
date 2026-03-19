# OpenClaw MCP Servers for SalesSuiteOS

## Purpose
Three custom MCP (Model Context Protocol) servers that connect QClaw/OpenClaw to Keith's SalesSuiteOS stack. Each server exposes tools for AI agent orchestration, voice calling, and avatar video generation.

## Architecture
```
openclaw-mcp-salessuiteos/
  shared/         # Shared HTTP client + SSE wrapper for Railway
  maybetech/      # MaybeTech AI agent builder MCP (6 tools)
  vapi/           # VAPI voice calling MCP (7 tools)
  heygen/         # HeyGen video + LiveAvatar MCP (9 tools)
  openclaw-config.json  # OpenClaw gateway MCP registration
  Procfile              # Railway multi-process deployment
```

## Rules
1. All API keys live in `.env` and are never committed. Use PLACEHOLDER_REPLACE values as reference.
2. Every server.ts exports its `server` object for SSE wrapping. Stdio mode is default; SSE mode activates via `MCP_SSE_MODE=true`.
3. HeyGen LiveAvatar tools attempt LiveAvatar API first, then fall back to HeyGen streaming API.

## Key Files
- `shared/http.ts` — Shared fetch wrapper with typed ApiResponse
- `shared/sse-wrapper.ts` — Express SSE transport for Railway deployment
- `maybetech/server.ts` — MaybeTech MCP: health, agents, conversations, invoke
- `vapi/server.ts` — VAPI MCP: health, assistants, calls, transcripts, phone numbers
- `heygen/server.ts` — HeyGen MCP: health, avatars, voices, video gen, LiveAvatar streaming
- `*/railway.ts` — Railway entry points (SSE mode)
- `openclaw-config.json` — OpenClaw gateway MCP server registration

## Deployment
- **Local**: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx tsx maybetech/server.ts`
- **Railway**: Deploy with Procfile. Each service gets its own PORT env var.
- **OpenClaw**: Import `openclaw-config.json` into gateway config.

## API Documentation
- MaybeTech: https://docs.maybetech.com
- VAPI: https://docs.vapi.ai
- HeyGen: https://docs.heygen.com/reference
- LiveAvatar: https://docs.liveavatar.com
- MCP SDK: https://modelcontextprotocol.io
