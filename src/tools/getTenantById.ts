import { Client, TenantRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";

export function registerGetTenantByIdTool(server: McpServer) {
  server.tool(
    "get_tenant_by_id",
    "Get details for a specific tenant by its ID",
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
              spaceId: tenant.SpaceId
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
  registerFn: registerGetTenantByIdTool
});