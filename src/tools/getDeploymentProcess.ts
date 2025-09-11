import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type DeploymentProcessResource } from "../types/deploymentProcessTypes.js";

export function registerGetDeploymentProcessTool(server: McpServer) {
  server.tool(
    "get_deployment_process",
    `Get deployment process by ID

This tool retrieves a deployment process by its ID. Each project has a deployment process attached, and releases/deployments can also have frozen processes attached.`,
    {
      spaceName: z.string(),
      processId: z.string(),
    },
    {
      title: "Get deployment process details from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ spaceName, processId }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceId = await resolveSpaceId(client, spaceName);

      const response = await client.get<DeploymentProcessResource>(
        "~/api/{spaceId}/deploymentprocesses/{processId}",
        {
          spaceId,
          processId,
        }
      );

      const deploymentProcess = {
        spaceId: response.SpaceId,
        id: response.Id,
        projectId: response.ProjectId,
        version: response.Version,
        lastSnapshotId: response.LastSnapshotId,
        steps: response.Steps.map((step) => ({
          id: step.Id,
          name: step.Name,
          condition: step.Condition,
          startTrigger: step.StartTrigger,
          packageRequirement: step.PackageRequirement,
          properties: step.Properties,
          actions: step.Actions,
        })),
      };

      return {
        content: [
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