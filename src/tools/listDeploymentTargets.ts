import { Client, resolveSpaceId, type ResourceCollection } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type DeploymentTargetResource } from "../types/deploymentTargetTypes.js";

export function registerListDeploymentTargetsTool(server: McpServer) {
  server.tool(
    "list_deployment_targets",
    `List deployment targets (machines) in a space

This tool lists all deployment targets in a given space. The space name is required. You can optionally filter by various parameters like name, roles, health status, etc.`,
    {
      spaceName: z.string(),
      skip: z.number().optional(),
      take: z.number().optional(),
      name: z.string().optional(),
      ids: z.array(z.string()).optional(),
      partialName: z.string().optional(),
      roles: z.array(z.string()).optional().describe("A list of roles / target tags to filter by."),
      isDisabled: z.boolean().optional(),
      healthStatuses: z.array(z.string()).optional().describe("Possible values: Healthy, Unhealthy, Unavailable, Unknown, HasWarnings"),
      commStyles: z.array(z.string()).optional(),
      tenantIds: z.array(z.string()).optional(),
      tenantTags: z.array(z.string()).optional(),
      environmentIds: z.array(z.string()).optional(),
      thumbprint: z.string().optional(),
      deploymentId: z.string().optional(),
      shellNames: z.array(z.string()).optional(),
      deploymentTargetTypes: z.array(z.string()).optional(),
    },
    {
      title: "List all deployment targets in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({
      spaceName,
      skip,
      take,
      name,
      ids,
      partialName,
      roles,
      isDisabled,
      healthStatuses,
      commStyles,
      tenantIds,
      tenantTags,
      environmentIds,
      thumbprint,
      deploymentId,
      shellNames,
      deploymentTargetTypes,
    }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceId = await resolveSpaceId(client, spaceName);

      const response = await client.get<ResourceCollection<DeploymentTargetResource>>(
        "~/api/{spaceId}/machines{?skip,take,name,ids,partialName,roles,isDisabled,healthStatuses,commStyles,tenantIds,tenantTags,environmentIds,thumbprint,deploymentId,shellNames,deploymentTargetTypes}",
        {
          spaceId,
          skip,
          take,
          name,
          ids,
          partialName,
          roles,
          isDisabled,
          healthStatuses,
          commStyles,
          tenantIds,
          tenantTags,
          environmentIds,
          thumbprint,
          deploymentId,
          shellNames,
          deploymentTargetTypes,
        }
      );
      const deploymentTargets = response.Items.map((target: DeploymentTargetResource) => ({
        spaceId: target.SpaceId,
        id: target.Id,
        name: target.Name,
        slug: target.Slug,
        isDisabled: target.IsDisabled,
        healthStatus: target.HealthStatus,
        statusSummary: target.StatusSummary,
        environmentIds: target.EnvironmentIds,
        roles: target.Roles,
        tenantedDeploymentParticipation: target.TenantedDeploymentParticipation,
        tenantIds: target.TenantIds,
        tenantTags: target.TenantTags,
        endpoint: {
          communicationStyle: target.Endpoint.CommunicationStyle,
          uri: target.Endpoint.Uri,
          fingerprint: target.Endpoint.Fingerprint,
        },
        shellName: target.ShellName,
        machinePolicyId: target.MachinePolicyId,
        hasLatestCalamari: target.HasLatestCalamari,
        isInProcess: target.IsInProcess,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: response.TotalResults,
              itemsPerPage: response.ItemsPerPage,
              numberOfPages: response.NumberOfPages,
              lastPageNumber: response.LastPageNumber,
              items: deploymentTargets,
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "list_deployment_targets",
  config: { toolset: "machines", readOnly: true },
  registerFn: registerListDeploymentTargetsTool,
});