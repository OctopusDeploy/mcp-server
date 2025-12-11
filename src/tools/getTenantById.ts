import { Client, TenantRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { tenantsDescription } from "../types/tenantsTypes.js";
import { getPublicUrl } from "../helpers/getPublicUrl.js";

export function registerGetTenantByIdTool(server: McpServer) {
  server.tool(
    "get_tenant_by_id",
    `Get details for a specific tenant by its ID, including the projects and environments the tenant is associated with. ${tenantsDescription}`,
    { 
      spaceName: z.string().describe("The space name"),
      tenantId: z.string().describe("The ID of the tenant to retrieve")
    },
    {
      title: "Get tenant details by ID from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ spaceName, tenantId }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const tenantRepository = new TenantRepository(client, spaceName);

      const tenant = await tenantRepository.get(tenantId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: tenant.Id,
              name: tenant.Name,
              description: tenant.Description,
              projectEnvironments: tenant.ProjectEnvironments,
              tenantTags: tenant.TenantTags,
              clonedFromTenantId: tenant.ClonedFromTenantId,
              spaceId: tenant.SpaceId,
              publicUrl: getPublicUrl(`${configuration.instanceURL}/app#/{spaceId}/tenants/{tenantId}/overview`, { spaceId: tenant.SpaceId, tenantId: tenant.Id }),
              publicUrlInstruction: `You can view more details about this tenant in the Octopus Deploy web portal at the provided publicUrl.`
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "get_tenant_by_id",
  config: { toolset: "tenants", readOnly: true },
  registerFn: registerGetTenantByIdTool,
});