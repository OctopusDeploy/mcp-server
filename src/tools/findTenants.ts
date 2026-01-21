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
import { tenantsDescription } from "../types/tenantsTypes.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";

export interface FindTenantsParams {
  spaceName: string;
  tenantId?: string;
  skip?: number;
  take?: number;
  projectId?: string;
  tags?: string;
  ids?: string[];
  partialName?: string;
}

export async function findTenantsHandler(params: FindTenantsParams) {
  const { spaceName, tenantId, skip, take, projectId, tags, ids, partialName } = params;
  const configuration = getClientConfigurationFromEnvironment();
  const client = await Client.create(configuration);
  const spaceId = await resolveSpaceId(client, spaceName);

  // If tenantId is provided, get a single tenant
  if (tenantId) {
    validateEntityId(tenantId, "tenant", ENTITY_PREFIXES.tenant);

    try {
      const tenant = await client.get<TenantResource>(
        "~/api/{spaceId}/tenant/{tenantId}",
        { spaceId, tenantId },
      );

      return {
        content: [
          {
            type: "text" as const,
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
  }

  // Otherwise, list tenants
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
            isDisabled: tenant.IsDisabled ?? false,
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

export function registerFindTenantsTool(server: McpServer) {
  server.tool(
    "find_tenants",
    `Find tenants in a space - can retrieve a single tenant by ID or list all tenants

  This unified tool can either:
  - Get details for a specific tenant when tenantId is provided, including the projects and environments the tenant is associated with
  - List all tenants in a space when tenantId is omitted

  ${tenantsDescription}

  Optionally provide filtering and pagination parameters when listing.`,
    {
      spaceName: z.string().describe("The space name"),
      tenantId: z.string().optional().describe("The ID of a specific tenant to retrieve. If omitted, lists all tenants."),
      skip: z.number().optional().describe("Number of tenants to skip for pagination (only used when listing)"),
      take: z.number().optional().describe("Number of tenants to take for pagination (only used when listing)"),
      projectId: z
        .string()
        .optional()
        .describe("Filter by specific project ID (only used when listing)"),
      tags: z
        .string()
        .optional()
        .describe("Filter by tenant tags (comma-separated list, only used when listing)"),
      ids: z
        .array(z.string())
        .optional()
        .describe("Filter by specific tenant IDs (only used when listing)"),
      partialName: z
        .string()
        .optional()
        .describe("Filter by partial tenant name match (only used when listing)"),
    },
    {
      title: "Find tenants in an Octopus Deploy space",
      readOnlyHint: true,
    },
    findTenantsHandler,
  );
}

registerToolDefinition({
  toolName: "find_tenants",
  config: { toolset: "tenants", readOnly: true },
  registerFn: registerFindTenantsTool,
});
