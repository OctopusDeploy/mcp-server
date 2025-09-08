import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSpacesResource } from "./spacesResource.js";

export function registerResources(server: McpServer) {
  registerSpacesResource(server);
}