import { Client, DeploymentRepository, SpaceServerTaskRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";

// TODO: review if this tool is needed, it should be possible for a competent model to retrieve this details by using the underlying tools

export function registerGetLatestDeploymentTool(server: McpServer) {
  server.tool(
    "get_latest_deployment",
    `Get details for the latest deployment of a project
    
    This tool finds the most recent deployment for a given project in a space and returns the deployment details along with the server task information.`,
    { spaceName: z.string(), projectId: z.string() },
    {
      title: "Get latest deployment details for an Octopus Deploy project",
      readOnlyHint: true,
    },
    async ({ spaceName, projectId }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      
      const deploymentRepository = new DeploymentRepository(client, spaceName);
      const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);

      // Get all deployments for the project, sorted by creation date descending
      const deploymentsResponse = await deploymentRepository.list({ 
        projects: [projectId]
      });
      
      if (deploymentsResponse.Items.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `No deployments found for project ${projectId}` }),
            },
          ],
        };
      }

      // Sort deployments by created date to get the latest
      const latestDeployment = deploymentsResponse.Items.sort((a, b) => 
        new Date(b.Created).getTime() - new Date(a.Created).getTime()
      )[0];

      // Get the server task details for the deployment
      let taskDetails = null;
      if (latestDeployment.TaskId) {
        try {
          taskDetails = await serverTaskRepository.getDetails(latestDeployment.TaskId);
        } catch (error) {
          console.error("Error getting task details:", error);
        }
      }

      const result = {
        deployment: {
          id: latestDeployment.Id,
          name: latestDeployment.Name,
          releaseId: latestDeployment.ReleaseId,
          environmentId: latestDeployment.EnvironmentId,
          tenantId: latestDeployment.TenantId,
          created: latestDeployment.Created,
          taskId: latestDeployment.TaskId,
          projectId: latestDeployment.ProjectId,
          channelId: latestDeployment.ChannelId,
          deploymentProcessId: latestDeployment.DeploymentProcessId,
          skipActions: latestDeployment.SkipActions,
          specificMachineIds: latestDeployment.SpecificMachineIds,
          excludedMachineIds: latestDeployment.ExcludedMachineIds,
          forcePackageDownload: latestDeployment.ForcePackageDownload,
          forcePackageRedeployment: latestDeployment.ForcePackageRedeployment,
          formValues: latestDeployment.FormValues,
          queueTime: latestDeployment.QueueTime,
          queueTimeExpiry: latestDeployment.QueueTimeExpiry,
          useGuidedFailure: latestDeployment.UseGuidedFailure,
          comments: latestDeployment.Comments,
        },
        taskDetails: taskDetails
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "get_latest_deployment",
  config: { toolset: "deployments", readOnly: true },
  registerFn: registerGetLatestDeploymentTool
});