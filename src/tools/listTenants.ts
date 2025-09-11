import { Client, TenantRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";

export function registerListTenantsTool(server: McpServer) {
  server.tool(
    "list_tenants",
    `List tenants in a space
  
  This tool lists all tenants in a given space. The space name is required. Optionally provide skip and take parameters for pagination.`,
    { 
      spaceName: z.string().describe("The space name"),
      skip: z.number().optional().describe("Number of items to skip for pagination"),
      take: z.number().optional().describe("Number of items to take for pagination"),
      projectId: z.string().optional().describe("Filter by specific project ID"),
      tags: z.string().optional().describe("Filter by tenant tags (comma-separated list)"),
      ids: z.array(z.string()).optional().describe("Filter by specific tenant IDs"),
      partialName: z.string().optional().describe("Filter by partial tenant name match")
    },
    {
      title: "List all tenants in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, skip, take, projectId, tags, ids, partialName }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const tenantRepository = new TenantRepository(client, spaceName);

      const tenantsResponse = await tenantRepository.list({ 
        skip, 
        take, 
        projectId, 
        tags, 
        ids, 
        partialName 
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: tenantsResponse.TotalResults,
              itemsPerPage: tenantsResponse.ItemsPerPage,
              numberOfPages: tenantsResponse.NumberOfPages,
              lastPageNumber: tenantsResponse.LastPageNumber,
              items: tenantsResponse.Items.map(tenant => ({
                id: tenant.Id,
                name: tenant.Name,
                description: tenant.Description,
                projectEnvironments: tenant.ProjectEnvironments,
                tenantTags: tenant.TenantTags,
                clonedFromTenantId: tenant.ClonedFromTenantId,
                spaceId: tenant.SpaceId
              }))
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "list_tenants",
  config: { toolset: "tenants", readOnly: true },
  registerFn: registerListTenantsTool
});