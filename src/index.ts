#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { Command } from "commander";
import dotenv from "dotenv";
import { createToolsetConfig } from "./utils/parseConfig.js";
import { DEFAULT_TOOLSETS, printToolVersionAnalysis } from "./types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "./helpers/getClientConfigurationFromEnvironment.js";
import { setClientInfo } from "./utils/clientInfo.js";
import { logger } from "./utils/logger.js";
import packageJson from "../package.json" with { type: "json" };
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export const SEMVER_VERSION = packageJson.version;

// Set entry directory for logger (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  .option("--log-file <path>", 'Log file path or filename. If not specified, logs are written to console only.')
  .option("-q, --quiet", "Disable file logging, only log errors to console", false)
  .option("--list-tools-by-version", "List all registered tools by their supported Octopus Server version and exit")
  .parse();

const options = program.opts();

const server = new McpServer({
  name: "Octopus Deploy",
  description: "Official Octopus Deploy MCP server.",
  version: SEMVER_VERSION,
});

const toolsetConfig = createToolsetConfig(options.toolsets, options.readOnly);
registerTools(server, toolsetConfig);

if (options.listToolsByVersion) {
  printToolVersionAnalysis();
  process.exit(0);
}

if (options.logFile) {
  if (dirname(options.logFile) === '.') {
    logger.setLogFilePath(join(__dirname, options.logFile));
  } else {
    logger.setLogFilePath(options.logFile);
  }
}

logger.setLogLevel(logger.parseLogLevel(options.logLevel));
logger.setQuietMode(options.quiet);

if (options.serverUrl) {
  process.env.CLI_SERVER_URL = options.serverUrl;
}
if (options.apiKey) {
  process.env.CLI_API_KEY = options.apiKey;
}

// Test configuration
getClientConfigurationFromEnvironment();

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
