import {
  Client,
  resolveSpaceId,
  type ResourceCollection,
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getPublicUrl } from "../helpers/getPublicUrl.js";
import type { TenantResource } from "../types/tenantsTypes.js";

export interface ListTenantsParams {
  spaceName: string;
  skip?: number;
  take?: number;
  projectId?: string;
  tags?: string;
  ids?: string[];
  partialName?: string;
}

export async function listTenantsHandler(params: ListTenantsParams) {
  const { spaceName, skip, take, projectId, tags, ids, partialName } = params;
  const configuration = getClientConfigurationFromEnvironment();
  const client = await Client.create(configuration);
  const spaceId = await resolveSpaceId(client, spaceName);

  const tenantsResponse = await client.get<ResourceCollection<TenantResource>>(
    "~/api/{spaceId}/tenants{?skip,take,projectId,tags,ids,partialName}",
    {
      spaceId,
      skip,
      take,
      projectId,
      tags,
      ids,
      partialName,
    },
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          totalResults: tenantsResponse.TotalResults,
          itemsPerPage: tenantsResponse.ItemsPerPage,
          numberOfPages: tenantsResponse.NumberOfPages,
          lastPageNumber: tenantsResponse.LastPageNumber,
          items: tenantsResponse.Items.map((tenant) => ({
            id: tenant.Id,
            name: tenant.Name,
            slug: tenant.Slug,
            description: tenant.Description,
            isDisabled: tenant.IsDisabled ?? false, // Disabling tenants was introduced in 2024.4. Prior to that, all tenants could be considered IsDisabled=false.
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
          })),
        }),
      },
    ],
  };
}

export function registerListTenantsTool(server: McpServer) {
  server.tool(
    "list_tenants",
    `List tenants in a space

  This tool lists all tenants in a given space. The space name is required. Optionally provide skip and take parameters for pagination.`,
    {
      spaceName: z.string().describe("The space name"),
      skip: z.number().optional(),
      take: z.number().optional(),
      projectId: z
        .string()
        .optional()
        .describe("Filter by specific project ID"),
      tags: z
        .string()
        .optional()
        .describe("Filter by tenant tags (comma-separated list)"),
      ids: z
        .array(z.string())
        .optional()
        .describe("Filter by specific tenant IDs"),
      partialName: z
        .string()
        .optional()
        .describe("Filter by partial tenant name match"),
    },
    {
      title: "List all tenants in an Octopus Deploy space",
      readOnlyHint: true,
    },
    listTenantsHandler,
  );
}

registerToolDefinition({
  toolName: "list_tenants",
  config: { toolset: "tenants", readOnly: true },
  registerFn: registerListTenantsTool,
});
