#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { Command } from "commander";
import dotenv from "dotenv";
import { createToolsetConfig } from "./utils/parseConfig.js";
import {
  DEFAULT_TOOLSETS,
  printToolVersionAnalysis,
} from "./types/toolConfig.js";
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
  .option(
    "--toolsets <toolsets>",
    `Comma-separated list of toolsets to enable, or "all" (default: all). Available toolsets: ${DEFAULT_TOOLSETS.join(", ")}`,
  )
  .option(
    "--no-read-only",
    "Disable read-only mode to enable write operations (default: read-only enabled)",
  )
  .option("--log-level <level>", "Minimum log level (info, error)", "info")
  .option(
    "--log-file <path>",
    "Log file path or filename. If not specified, logs are written to console only.",
  )
  .option(
    "-q, --quiet",
    "Disable file logging, only log errors to console",
    false,
  )
  .option(
    "--list-tools-by-version",
    "List all registered tools by their supported Octopus Server version and exit",
  )
  .parse();

const options = program.opts();

// Resolve the Octopus server URL up front so the MCP `instructions` string
// can advertise which instance the client is connected to. Mirrors the
// precedence used by getClientConfigurationFromEnvironment (CLI flag wins
// over OCTOPUS_SERVER_URL env var).
if (options.serverUrl) {
  process.env.CLI_SERVER_URL = options.serverUrl;
}
const configuredServerUrl =
  process.env.CLI_SERVER_URL ||
  process.env.OCTOPUS_SERVER_URL ||
  "(not configured — set OCTOPUS_SERVER_URL or pass --server-url)";

const SERVER_INSTRUCTIONS = `
The official Octopus Deploy MCP server, currently connected to: ${configuredServerUrl}

Tools are grouped into toolsets (core, releases, deployments, tasks, tenants, kubernetes, machines, certificates, accounts, interruptions, featureToggles) and you can filter them via --toolsets. Writes are gated behind --no-read-only.

Resource URIs and how to dereference them:
- Many tools return slim summaries plus an 'octopus://...' URI in fields like 'resourceUri' or 'taskResourceUri' instead of inlining heavy payloads (release notes, packaged versions, structured task activity trees, etc.). To fetch the full body, dereference the URI.
- Resource-aware clients (Claude Code, MCP Inspector): call the standard 'resources/read' primitive with the URI.
- Clients without native resources/read (Claude.ai web, several IDE integrations): call the 'read_resource' tool with { uri }. It returns the same body as resources/read. Always available, regardless of toolset filter.
- The 'read_resource' tool is the universal bridge from any URI returned by any tool — if you see an 'octopus://' string in a response and don't know what to do with it, call read_resource with it.

Currently exposed resource families:
- releases: 'octopus://spaces/{spaceName}/releases/{releaseId}'
- tasks: 'octopus://spaces/{spaceName}/tasks/{taskId}' (metadata) and '/details' (structured ActivityLogs tree)
- interruptions: 'octopus://spaces/{spaceName}/interruptions/{interruptionId}' (full Form definition with control types, Markdown instructions, button options like Abort/Proceed, and any submitted Form.Values). The find_interruptions tool returns slim summaries that point at this URI; dereference it to drill into a specific interruption.
- feature toggles: 'octopus://spaces/{spaceName}/projects/{projectId}/featuretoggles/{slug}' (full toggle body — per-environment configuration including tenant lists, segments, minimum versions). The find_feature_toggles slim summaries omit those fields and point at this URI.
- rollout groups: 'octopus://spaces/{spaceName}/projects/{projectId}/rolloutgroups/{rolloutGroupId}' (read-only — this server doesn't expose rollout group writes; use the Octopus UI for those).

There is intentionally NO 'octopus://.../tasks/{id}/log' resource. Activity logs can be multi-megabyte; an addressable resource would tempt you to fetch the entire body when you almost always want only the matching lines. To search a task log, call the 'grep_task_log' tool — its parameters mirror GNU grep (pattern, caseInsensitive, invertMatch, fixedString, beforeContext, afterContext, maxCount) and it returns matching lines with totalMatches count and optional context windows. For step hierarchy / categories / timing, fetch the /details resource instead.

More resource families will be added over time.
`.trim();

const server = new McpServer(
  {
    name: "Octopus Deploy",
    description: "Official Octopus Deploy MCP server.",
    version: SEMVER_VERSION,
  },
  {
    instructions: SERVER_INSTRUCTIONS,
  },
);

const toolsetConfig = createToolsetConfig(options.toolsets, options.readOnly);
registerTools(server, toolsetConfig);
registerResources(server, toolsetConfig);

if (options.listToolsByVersion) {
  printToolVersionAnalysis();
  process.exit(0);
}

if (options.logFile) {
  if (dirname(options.logFile) === ".") {
    logger.setLogFilePath(join(__dirname, options.logFile));
  } else {
    logger.setLogFilePath(options.logFile);
  }
}

logger.setLogLevel(logger.parseLogLevel(options.logLevel));
logger.setQuietMode(options.quiet);

// CLI_SERVER_URL is set earlier so the MCP instructions string can reference it.

// Set up initialization callback to capture client info
server.server.oninitialized = () => {
  const clientInfo = server.server.getClientVersion();
  if (clientInfo) {
    setClientInfo(clientInfo.name, clientInfo.version);
    logger.info(
      `Client initialized: ${clientInfo.name} v${clientInfo.version}`,
    );
  } else {
    logger.info("Client initialized but no client info available");
  }
};

logger.info(`Starting Octopus Deploy MCP server (version: ${SEMVER_VERSION})`);

// Start server
async function runServer() {
  // Test configuration
  getClientConfigurationFromEnvironment();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  logger.error(`Fatal error running server: ${error.message}\n${error.stack}`);
  process.exit(1);
});
