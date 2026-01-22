import { Client, resolveSpaceId, type ResourceCollection } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type CertificateResource, mapCertificateResource } from "../types/certificateTypes.js";
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

export function registerFindCertificatesTool(server: McpServer) {
  server.tool(
    "find_certificates",
    `Find certificates in a space - can retrieve a single certificate by ID or list all certificates

This unified tool can either:
- Get detailed information about a specific certificate when certificateId is provided
- List all certificates in a space when certificateId is omitted

You can optionally filter by various parameters like name, archived status, tenant, etc. when listing.`,
    {
      spaceName: z.string(),
      certificateId: z.string().optional().describe("The ID of a specific certificate to retrieve. If omitted, lists all certificates."),
      skip: z.number().optional().describe("Number of certificates to skip for pagination (only used when listing)"),
      take: z.number().optional().describe("Number of certificates to take for pagination (only used when listing)"),
      search: z.string().optional().describe("Search term to filter certificates (only used when listing)"),
      archived: z.boolean().optional().describe("Filter by archived status (only used when listing)"),
      tenant: z.string().optional().describe("Filter by tenant (only used when listing)"),
      firstResult: z.number().optional().describe("Index of first result to return (only used when listing)"),
      orderBy: z.string().optional().describe("Field to order results by (only used when listing)"),
      ids: z.array(z.string()).optional().describe("Filter by specific certificate IDs (only used when listing)"),
      partialName: z.string().optional().describe("Filter by partial name match (only used when listing)"),
    },
    {
      title: "Find certificates in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({
      spaceName,
      certificateId,
      skip,
      take,
      search,
      archived,
      tenant,
      firstResult,
      orderBy,
      ids,
      partialName,
    }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceId = await resolveSpaceId(client, spaceName);

      // If certificateId is provided, get a single certificate
      if (certificateId) {
        validateEntityId(certificateId, 'certificate', ENTITY_PREFIXES.certificate);

        try {
          const response = await client.get<CertificateResource>(
            "~/api/{spaceId}/certificates/{id}",
            {
              spaceId,
              id: certificateId,
            }
          );

          const certificate = mapCertificateResource(response);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(certificate),
              },
            ],
          };
        } catch (error) {
          handleOctopusApiError(error, {
            entityType: 'certificate',
            entityId: certificateId,
            spaceName
          });
        }
      }

      // Otherwise, list all certificates
      const response = await client.get<ResourceCollection<CertificateResource>>(
        "~/api/{spaceId}/certificates{?skip,take,search,archived,tenant,firstResult,orderBy,ids,partialName}",
        {
          spaceId,
          skip,
          take,
          search,
          archived,
          tenant,
          firstResult,
          orderBy,
          ids,
          partialName,
        }
      );

      const certificates = response.Items.map((cert: CertificateResource) => mapCertificateResource(cert));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: response.TotalResults,
              itemsPerPage: response.ItemsPerPage,
              numberOfPages: response.NumberOfPages,
              lastPageNumber: response.LastPageNumber,
              items: certificates,
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "find_certificates",
  config: { toolset: "certificates", readOnly: true },
  registerFn: registerFindCertificatesTool,
});
