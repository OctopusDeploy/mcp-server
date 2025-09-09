import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListProjectsTool } from "./listProjects.js";
import { registerListSpacesTool } from "./listSpaces.js";
import { registerGetLatestDeploymentTool } from "./getLatestDeployment.js";
import { registerListEnvironmentsTool } from "./listEnvironments.js";
import { registerListDeploymentsTool } from "./listDeployments.js";
import { registerGetReleaseByIdTool } from "./getReleaseById.js";
import { registerListReleasesTool } from "./listReleases.js";
import { registerListReleasesForProjectTool } from "./listReleasesForProject.js";
import { registerGetTaskByIdTool } from "./getTaskById.js";
import { registerGetTaskDetailsTool } from "./getTaskDetails.js";
import { registerGetTaskRawTool } from "./getTaskRaw.js";

export function registerTools(server: McpServer) {
  registerListSpacesTool(server);
  registerListProjectsTool(server);
  registerListEnvironmentsTool(server);
  registerListDeploymentsTool(server);
  registerGetLatestDeploymentTool(server);
  registerGetReleaseByIdTool(server);
  registerListReleasesTool(server);
  registerListReleasesForProjectTool(server);
  registerGetTaskByIdTool(server);
  registerGetTaskDetailsTool(server);
  registerGetTaskRawTool(server);
}