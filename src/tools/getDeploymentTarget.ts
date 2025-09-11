import { Client } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type DeploymentTargetResource } from "../types/deploymentTargetTypes.js";

export function registerGetDeploymentTargetTool(server: McpServer) {
  server.tool(
    "get_deployment_target",
    `Get a specific deployment target (machine) by ID

This tool retrieves detailed information about a specific deployment target using its ID. The space name and target ID are both required.`,
    {
      spaceId: z.string(),
      targetId: z.string(),
    },
    {
      title: "Get a specific deployment target from an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceId, targetId }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);

      const target = await client.get<DeploymentTargetResource>(
        "~/api/spaces/{spaceId}/machines/{id}",
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
    }
  );
}

registerToolDefinition({
  toolName: "get_deployment_target",
  config: { toolset: "machines", readOnly: true },
  registerFn: registerGetDeploymentTargetTool
});