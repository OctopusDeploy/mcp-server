#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { Command } from "commander";
import dotenv from "dotenv";
import { createToolsetConfig } from "./utils/parseConfig.js";
import { DEFAULT_TOOLSETS } from "./types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "./helpers/getClientConfigurationFromEnvironment.js";
import { setClientInfo } from "./utils/clientInfo.js";
import { logger } from "./utils/logger.js";
import packageJson from "../package.json" with { type: "json" };

export const SEMVER_VERSION = packageJson.version;

dotenv.config({ quiet: true });

// Parse command line arguments
const program = new Command();
program
  .name("octopus-mcp-server")
  .description("Octopus Deploy MCP Server")
  .version(SEMVER_VERSION)
  .option("-s, --server-url <url>", "Octopus server URL")
  .option("-k, --api-key <key>", "Octopus API key")
  .option("--toolsets <toolsets>", `Comma-separated list of toolsets to enable, or "all" (default: all). Available toolsets: ${DEFAULT_TOOLSETS.join(", ")}`)
  .option("--read-only", "Enable read-only mode (default: enabled)", true)
  .option("--log-level <level>", "Minimum log level (info, error)", "info")
  .option("--log-file <path>", "Log file path or filename (default: mcp-server-log.txt)")
  .option("-q, --quiet", "Disable file logging, only log errors to console", false)
  .parse();

const options = program.opts();

// Configure logger based on command line options
if (options.logFile) {
  logger.setLogFilePath(options.logFile);
}
logger.setLogLevel(logger.parseLogLevel(options.logLevel));
logger.setQuietMode(options.quiet);

// Pass CLI options to tools registration
if (options.serverUrl) {
  process.env.CLI_SERVER_URL = options.serverUrl;
}
if (options.apiKey) {
  process.env.CLI_API_KEY = options.apiKey;
}

// Test configuration
getClientConfigurationFromEnvironment();

// Create toolset configuration
const toolsetConfig = createToolsetConfig(options.toolsets, options.readOnly);

const server = new McpServer({
  name: "Octopus Deploy",
  description: "Official Octopus Deploy MCP server.",
  version: SEMVER_VERSION,
});

// Set up initialization callback to capture client info
server.server.oninitialized = () => {
  const clientInfo = server.server.getClientVersion();
  if (clientInfo) {
    setClientInfo(clientInfo.name, clientInfo.version);
    logger.info(`Client initialized: ${clientInfo.name} v${clientInfo.version}`);
  } else {
    logger.info("Client initialized but no client info available");
  }
};

registerTools(server, toolsetConfig);

logger.info(`Starting Octopus Deploy MCP server (version: ${SEMVER_VERSION})`);

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  logger.error(`Fatal error running server: ${error.message}\n${error.stack}`);
  process.exit(1);
});
