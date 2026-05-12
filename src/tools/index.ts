import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ToolsetConfig,
  TOOL_REGISTRY,
  DEFAULT_TOOLSETS,
  type ToolRegistration,
} from "../types/toolConfig.js";

// Import all tool files to trigger their self-registration
import "./listSpaces.js";
import "./listProjects.js";
import "./listEnvironments.js";
import "./listDeployments.js";
import "./getTenantVariables.js";
import "./getMissingTenantVariables.js";
import "./getKubernetesLiveStatus.js";
import "./getDeploymentProcess.js";
import "./getBranches.js";
import "./getCurrentUser.js";
import "./getVariables.js";
import "./getTaskFromUrl.js";
import "./getDeploymentFromUrl.js";

// Unified Find endpoints (replacing separate list/get pairs)
import "./findReleases.js";
import "./findRunbooks.js";
import "./findTenants.js";
import "./findDeploymentTargets.js";
import "./findCertificates.js";
import "./findAccounts.js";
import "./findInterruptions.js";

// Feature toggles
import "./findFeatureToggles.js";
import "./updateFeatureToggle.js";

// Write operations
import "./createRelease.js";
import "./deployRelease.js";
import "./runRunbook.js";

// Task log search
import "./grepTaskLog.js";

// API catalog search (llms.txt)
import "./grepLlmsTxt.js";

// REST backstop with hard read/write/delete gating
import "./execute.js";

// Resource backstop for clients without native MCP resource support
import "./readResource.js";
export function isToolEnabled(
  toolRegistration: ToolRegistration,
  config: ToolsetConfig,
): boolean {
  if (!toolRegistration) {
    return false;
  }

  // Check if toolset is enabled
  const enabledToolsets =
    config.enabledToolsets === "all"
      ? DEFAULT_TOOLSETS
      : config.enabledToolsets || DEFAULT_TOOLSETS;

  if (
    toolRegistration.config.toolset !== "core" &&
    !enabledToolsets.includes(toolRegistration.config.toolset)
  ) {
    return false;
  }

  // Check read-only mode. Method-gated tools (e.g. `execute`) bypass this
  // filter because they classify themselves at runtime — they stay registered
  // even in read-only mode, where the handler will refuse non-read calls.
  if (
    config.readOnlyMode &&
    !toolRegistration.config.readOnly &&
    !toolRegistration.config.methodGated
  ) {
    return false;
  }

  return true;
}

export function registerTools(server: McpServer, config: ToolsetConfig = {}) {
  // Iterate through all registered tools and register those that are enabled
  for (const [, toolRegistration] of TOOL_REGISTRY) {
    if (isToolEnabled(toolRegistration, config)) {
      toolRegistration.registerFn(server);
    }
  }
}
