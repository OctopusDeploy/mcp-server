import { Client, resolveSpaceId, type ResourceCollection } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type DeploymentTargetResource } from "../types/deploymentTargetTypes.js";
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

export function registerFindDeploymentTargetsTool(server: McpServer) {
  server.tool(
    "find_deployment_targets",
    `Find deployment targets (machines) in a space - can retrieve a single target by ID or list all targets

This unified tool can either:
- Get detailed information about a specific deployment target when targetId is provided
- List all deployment targets in a space when targetId is omitted

You can optionally filter by various parameters like name, roles, health status, etc. when listing.`,
    {
      spaceName: z.string(),
      targetId: z.string().optional().describe("The ID of a specific deployment target to retrieve. If omitted, lists all deployment targets."),
      skip: z.number().optional().describe("Number of targets to skip for pagination (only used when listing)"),
      take: z.number().optional().describe("Number of targets to take for pagination (only used when listing)"),
      name: z.string().optional().describe("Filter by exact name (only used when listing)"),
      ids: z.array(z.string()).optional().describe("Filter by specific target IDs (only used when listing)"),
      partialName: z.string().optional().describe("Filter by partial name match (only used when listing)"),
      roles: z.array(z.string()).optional().describe("A list of roles / target tags to filter by (only used when listing)"),
      isDisabled: z.boolean().optional().describe("Filter by disabled status (only used when listing)"),
      healthStatuses: z.array(z.string()).optional().describe("Possible values: Healthy, Unhealthy, Unavailable, Unknown, HasWarnings (only used when listing)"),
      commStyles: z.array(z.string()).optional().describe("Filter by communication styles (only used when listing)"),
      tenantIds: z.array(z.string()).optional().describe("Filter by tenant IDs (only used when listing)"),
      tenantTags: z.array(z.string()).optional().describe("Filter by tenant tags (only used when listing)"),
      environmentIds: z.array(z.string()).optional().describe("Filter by environment IDs (only used when listing)"),
      thumbprint: z.string().optional().describe("Filter by thumbprint (only used when listing)"),
      deploymentId: z.string().optional().describe("Filter by deployment ID (only used when listing)"),
      shellNames: z.array(z.string()).optional().describe("Filter by shell names (only used when listing)"),
      deploymentTargetTypes: z.array(z.string()).optional().describe("Filter by deployment target types (only used when listing)"),
    },
    {
      title: "Find deployment targets in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({
      spaceName,
      targetId,
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

      // If targetId is provided, get a single deployment target
      if (targetId) {
        validateEntityId(targetId, 'machine', ENTITY_PREFIXES.machine);

        try {
          const target = await client.get<DeploymentTargetResource>(
            "~/api/{spaceId}/machines/{id}",
            {
              spaceId,
              id: targetId,
            }
          );

          const deploymentTarget = {
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
              id: target.Endpoint.Id,
              communicationStyle: target.Endpoint.CommunicationStyle,
              uri: target.Endpoint.Uri,
              fingerprint: target.Endpoint.Fingerprint,
              proxyId: target.Endpoint.ProxyId,
              tentacleVersionDetails: target.Endpoint.TentacleVersionDetails,
            },
            shellName: target.ShellName,
            machinePolicyId: target.MachinePolicyId,
            hasLatestCalamari: target.HasLatestCalamari,
            isInProcess: target.IsInProcess,
            links: target.Links,
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(deploymentTarget),
              },
            ],
          };
        } catch (error) {
          handleOctopusApiError(error, {
            entityType: 'deployment target',
            entityId: targetId,
            spaceName,
            helpText: "Use find_deployment_targets without targetId to find valid target IDs."
          });
        }
      }

      // Otherwise, list all deployment targets
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
  toolName: "find_deployment_targets",
  config: { toolset: "machines", readOnly: true },
  registerFn: registerFindDeploymentTargetsTool,
});
