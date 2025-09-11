import { Client, resolveSpaceId, ProjectRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type DeploymentProcessResource } from "../types/deploymentProcessTypes.js";
import { getProjectBranches } from "../helpers/vcsProjectHelpers.js";

export function registerGetDeploymentProcessTool(server: McpServer) {
  server.tool(
    "get_deployment_process",
    `Get deployment process by ID

This tool retrieves a deployment process by its ID. Each project has a deployment process attached, and releases/deployments can also have frozen processes attached.`,
    {
      spaceName: z.string(),
      projectId: z.string().optional().describe("The ID of the project to retrieve the deployment process for. If processId is not provided, this parameter is required."),
      processId: z.string().optional().describe("The ID of the deployment process to retrieve. If not provided, the deployment process for the project will be retrieved."),
      branchName: z.string().optional().describe("Optional branch name to get the deployment process for a specific branch (if using version controlled projects). Try `main` or `master` if unsure."),
      includeDetails: z.boolean().optional().default(false).describe("Include detailed properties for steps and actions. Defaults to false."),
    },
    {
      title: "Get deployment process details from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ spaceName, processId, projectId, branchName, includeDetails = false }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceId = await resolveSpaceId(client, spaceName);
      const projectRepository = projectId ? new ProjectRepository(client, spaceName) : null;
      const project = projectRepository && projectId ? await projectRepository.get(projectId) : null;

      if (!processId && !projectId) {
        throw new Error("Either processId or projectId must be provided.");
      }

      if (project?.IsVersionControlled && !branchName) {
        throw new Error("Branch name must be provided for version controlled projects.");
      }

      // If using branchName get the canonical ref first
      const branches = branchName && projectId && await getProjectBranches(client, spaceId, projectId, { take: 1, searchByName: branchName });
      const gitRef = branches && branches.Items.length > 0 ? branches.Items[0].CanonicalName : undefined;

      const url = gitRef
        ? `~/api/{spaceId}/projects/{projectId}/{gitRef}/deploymentprocesses`
        : `~/api/{spaceId}/deploymentprocesses/{processId}`;

      const response = await client.get<DeploymentProcessResource>(
        url,
        {
          spaceId,
          projectId,
          processId,
          gitRef
        }
      );

      const deploymentProcess = {
        spaceId: response.SpaceId,
        id: response.Id,
        projectId: response.ProjectId,
        version: response.Version,
        lastSnapshotId: response.LastSnapshotId,
        steps: response.Steps.map((step) => {
          const mappedStep = {
            id: step.Id,
            name: step.Name,
            condition: step.Condition,
            startTrigger: step.StartTrigger,
            packageRequirement: step.PackageRequirement,
            ...(includeDetails && { properties: step.Properties }),
            actions: step.Actions.map((action) => {
              if (includeDetails) {
                return action;
              } else {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { Properties, ...actionWithoutProperties } = action;
                return actionWithoutProperties;
              }
            }),
          };
          
          return mappedStep;
        }),
      };

      return {
        content: [
          {
            type: "text",
            text: `Retrieved deployment process with ID '${deploymentProcess.id}' in space '${spaceName}'${branchName ? ` for branch '${branchName}'` : ""}.`,
          },
          {
            type: "text",
            text: JSON.stringify(deploymentProcess),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "get_deployment_process",
  config: { toolset: "projects", readOnly: true },
  registerFn: registerGetDeploymentProcessTool
});