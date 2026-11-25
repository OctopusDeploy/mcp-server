import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiagnoseDeploymentFailurePrompt } from "./diagnoseDeploymentFailure.js";
import { registerAddReleaseNotesPrompt } from "./addReleaseNotes.js";

export function registerPrompts(server: McpServer) {
  registerDiagnoseDeploymentFailurePrompt(server);
  registerAddReleaseNotesPrompt(server);
}
