import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type DeploymentTargetResource } from "../types/deploymentTargetTypes.js";
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

export function registerGetDeploymentTargetTool(server: McpServer) {
  server.tool(
    "get_deployment_target",
    `Get a specific deployment target (machine) by ID

This tool retrieves detailed information about a specific deployment target using its ID. The space name and target ID are both required.`,
    {
      spaceName: z.string(),
      targetId: z.string(),
    },
    {
      title: "Get a specific deployment target from an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, targetId }) => {
      validateEntityId(targetId, 'machine', ENTITY_PREFIXES.machine);

      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const spaceId = await resolveSpaceId(client, spaceName);

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
          helpText: "Use list_deployment_targets to find valid target IDs."
        });
      }
    }
  );
}

registerToolDefinition({
  toolName: "get_deployment_target",
  config: { toolset: "machines", readOnly: true },
  registerFn: registerGetDeploymentTargetTool,
});