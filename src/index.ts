import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const SEMVER_VERSION = "0.0.1"; // TODO: replace this with GHA

const server = new McpServer({
  name: "Octopus Deploy",
  description: "Official Octopus Deploy MCP server",
  version: SEMVER_VERSION,
});

console.info(`Starting Octopus Deploy MCP server (version: ${SEMVER_VERSION})`);

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.info("Octopus Deploy MCP server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});