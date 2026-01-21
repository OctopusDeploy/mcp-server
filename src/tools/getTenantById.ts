import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import {
  type TenantResource,
  tenantsDescription,
} from "../types/tenantsTypes.js";
import { getPublicUrl } from "../helpers/getPublicUrl.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";

export function registerGetTenantByIdTool(server: McpServer) {
  server.tool(
    "get_tenant_by_id",
    `Get details for a specific tenant by its ID, including the projects and environments the tenant is associated with. ${tenantsDescription}`,
    {
      spaceName: z.string().describe("The space name"),
      tenantId: z.string().describe("The ID of the tenant to retrieve"),
    },
    {
      title: "Get tenant details by ID from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ spaceName, tenantId }) => {
      validateEntityId(tenantId, "tenant", ENTITY_PREFIXES.tenant);

      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const spaceId = await resolveSpaceId(client, spaceName);

        const tenant = await client.get<TenantResource>(
          "~/api/{spaceId}/tenant/{tenantId}",
          { spaceId, tenantId },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: tenant.Id,
                name: tenant.Name,
                slug: tenant.Slug,
                description: tenant.Description,
                isDisabled: tenant.IsDisabled,
                projectEnvironments: tenant.ProjectEnvironments,
                tenantTags: tenant.TenantTags,
                clonedFromTenantId: tenant.ClonedFromTenantId,
                spaceId: tenant.SpaceId,
                publicUrl: getPublicUrl(
                  `${configuration.instanceURL}/app#/{spaceId}/tenants/{tenantId}/overview`,
                  {
                    spaceId: tenant.SpaceId,
                    tenantId: tenant.Id,
                  },
                ),
                publicUrlInstruction: `You can view more details about this tenant in the Octopus Deploy web portal at the provided publicUrl.`,
              }),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, {
          entityType: "tenant",
          entityId: tenantId,
          spaceName,
        });
      }
    },
  );
}

registerToolDefinition({
  toolName: "get_tenant_by_id",
  config: { toolset: "tenants", readOnly: true },
  registerFn: registerGetTenantByIdTool,
});
