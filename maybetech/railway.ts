import "dotenv/config";
process.env.MCP_SSE_MODE = "true";
import { server } from "./server.js";
import { createSSEServer } from "../shared/sse-wrapper.js";

const port = parseInt(process.env.PORT || "3000", 10);
createSSEServer(server, port);
