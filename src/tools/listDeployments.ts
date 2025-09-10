import { Client, DeploymentRepository, TaskState, type Deployment } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";

export function registerListDeploymentsTool(server: McpServer) {
  server.tool(
    "list_deployments",
    `List deployments in a space
  
  This tool lists deployments in a given space. The space name is required. Optional filters include: projects (array of project IDs), environments (array of environment IDs), tenants (array of tenant IDs), channels (array of channel IDs), taskState (one of: Canceled, Cancelling, Executing, Failed, Queued, Success, TimedOut), and take (number of results to return).`,
    { 
      space: z.string(), 
      projects: z.array(z.string()).optional(),
      environments: z.array(z.string()).optional(),
      tenants: z.array(z.string()).optional(),
      channels: z.array(z.string()).optional(),
      taskState: z.enum(["Canceled", "Cancelling", "Executing", "Failed", "Queued", "Success", "TimedOut"]).optional(),
      take: z.number().optional()
    },
    {
      title: "List deployments in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ space, projects, environments, tenants, channels, taskState, take }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const deploymentRepository = new DeploymentRepository(client, space);

      const deploymentsResponse = await deploymentRepository.list({ 
        projects,
        environments,
        tenants,
        channels,
        taskState: taskState ? TaskState[taskState as keyof typeof TaskState] : undefined,
        take
      });
      
      const deployments = deploymentsResponse.Items.map((deployment: Deployment) => ({
        spaceId: deployment.SpaceId,
        id: deployment.Id,
        name: deployment.Name,
        releaseId: deployment.ReleaseId,
        environmentId: deployment.EnvironmentId,
        tenantId: deployment.TenantId,
        projectId: deployment.ProjectId,
        channelId: deployment.ChannelId,
        created: deployment.Created,
        taskId: deployment.TaskId,
        deploymentProcessId: deployment.DeploymentProcessId,
        comments: deployment.Comments,
        formValues: deployment.FormValues,
        queueTime: deployment.QueueTime,
        queueTimeExpiry: deployment.QueueTimeExpiry,
        useGuidedFailure: deployment.UseGuidedFailure,
        specificMachineIds: deployment.SpecificMachineIds,
        excludedMachineIds: deployment.ExcludedMachineIds,
        skipActions: deployment.SkipActions,
        forcePackageDownload: deployment.ForcePackageDownload,
        forcePackageRedeployment: deployment.ForcePackageRedeployment,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(deployments),
          },
        ],
      };
    }
  );
}