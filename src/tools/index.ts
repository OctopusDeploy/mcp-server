import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListProjectsTool } from "./listProjects.js";
import { registerListSpacesTool } from "./listSpaces.js";

export function registerTools(server: McpServer) {
  registerListSpacesTool(server);
  registerListProjectsTool(server);
}