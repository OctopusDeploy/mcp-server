import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  type ToolsetConfig, 
  TOOL_REGISTRY, 
  DEFAULT_TOOLSETS, 
  type ToolRegistration
} from "../types/toolConfig.js";

// Import all tool files to trigger their self-registration
import "./listSpaces.js";
import "./listProjects.js";
import "./listEnvironments.js";
import "./listDeployments.js";
import "./getLatestDeployment.js";
import "./getReleaseById.js";
import "./listReleases.js";
import "./listReleasesForProject.js";
import "./getTaskById.js";
import "./getTaskDetails.js";
import "./getTaskRaw.js";
import "./listTenants.js";
import "./getTenantById.js";
import "./getTenantVariables.js";
import "./getMissingTenantVariables.js";
import "./getKubernetesLiveStatus.js";
import "./listDeploymentTargets.js";
import './getDeploymentTarget.js';
import './getDeploymentProcess.js';
import './getBranches.js';
import './getCurrentUser.js';

function isToolEnabled(toolRegistration: ToolRegistration, config: ToolsetConfig): boolean {
  if (!toolRegistration) {
    return false;
  }

  // Check if toolset is enabled
  const enabledToolsets = config.enabledToolsets === "all" 
    ? DEFAULT_TOOLSETS 
    : (config.enabledToolsets || DEFAULT_TOOLSETS);
  
  if (toolRegistration.config.toolset !== "core" && !enabledToolsets.includes(toolRegistration.config.toolset)) {
    return false;
  }

  // Check read-only mode
  if (config.readOnlyMode && !toolRegistration.config.readOnly) {
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