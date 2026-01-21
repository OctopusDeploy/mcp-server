import { Client, DeploymentRepository, ReleaseRepository, TaskState, type Deployment } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getPublicUrl } from "../helpers/getPublicUrl.js";

export function registerListDeploymentsTool(server: McpServer) {
  server.tool(
    "list_deployments",
    `List deployments in a space
  
  This tool lists deployments in a given space. The space name is required. When requesting latest deployment consider which deployment state the user is interested in (successful or all). Optional filters include: projects (array of project IDs), environments (array of environment IDs), tenants (array of tenant IDs), channels (array of channel IDs), taskState (one of: Canceled, Cancelling, Executing, Failed, Queued, Success, TimedOut), and take (number of results to return).`,
    {
      spaceName: z.string(),
      projects: z.array(z.string()).optional(),
      environments: z.array(z.string()).optional(),
      tenants: z.array(z.string()).optional(),
      channels: z.array(z.string()).optional(),
      taskState: z.enum(["Canceled", "Cancelling", "Executing", "Failed", "Queued", "Success", "TimedOut"]).optional(),
      skip: z.number().optional(),
      take: z.number().optional()
    },
    {
      title: "List deployments in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, projects, environments, tenants, channels, taskState, skip, take }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const deploymentRepository = new DeploymentRepository(client, spaceName);

      const deploymentsResponse = await deploymentRepository.list({
        projects,
        environments,
        tenants,
        channels,
        taskState: taskState ? TaskState[taskState as keyof typeof TaskState] : undefined,
        skip,
        take
      });

      const deployments = deploymentsResponse.Items as Deployment[];
      const releaseIds = Array.from(
        new Set(
          deployments
            .map((deployment) => deployment.ReleaseId)
            .filter((releaseId): releaseId is string => Boolean(releaseId))
        )
      );

      const releaseVersions = new Map<string, string>();

      if (releaseIds.length > 0) {
        const releaseRepository = new ReleaseRepository(client, spaceName);
        const releaseResults = await Promise.allSettled(releaseIds.map((id) => releaseRepository.get(id)));

        releaseResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            releaseVersions.set(releaseIds[index]!, result.value.Version);
          }
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: deploymentsResponse.TotalResults,
              itemsPerPage: deploymentsResponse.ItemsPerPage,
              numberOfPages: deploymentsResponse.NumberOfPages,
              lastPageNumber: deploymentsResponse.LastPageNumber,
              items: deployments.map((deployment) => {
                const releaseVersion = deployment.ReleaseId ? releaseVersions.get(deployment.ReleaseId) : undefined;
                const publicUrl = releaseVersion
                  ? getPublicUrl(
                      `${configuration.instanceURL}/app#/{spaceId}/projects/{projectId}/deployments/releases/{releaseVersion}/deployments/{deploymentId}`,
                      {
                        spaceId: deployment.SpaceId,
                        projectId: deployment.ProjectId,
                        releaseVersion,
                        deploymentId: deployment.Id,
                      }
                    )
                  : undefined;

                return {
                  spaceId: deployment.SpaceId,
                  id: deployment.Id,
                  name: deployment.Name,
                  releaseId: deployment.ReleaseId,
                  releaseVersion,
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
                  publicUrl,
                  publicUrlInstruction: publicUrl
                    ? "You can view more details about this deployment in the Octopus Deploy web portal at the provided publicUrl."
                    : undefined,
                };
              })
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "list_deployments",
  config: { toolset: "deployments", readOnly: true },
  registerFn: registerListDeploymentsTool,
});
