import { Client, resolveSpaceId, type ResourceCollection } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type CertificateResource, mapCertificateResource } from "../types/certificateTypes.js";

export function registerListCertificatesTool(server: McpServer) {
  server.tool(
    "list_certificates",
    `List certificates in a space

This tool lists all certificates in a given space. The space name is required. You can optionally filter by various parameters like name, archived status, tenant, etc.`,
    {
      spaceName: z.string(),
      skip: z.number().optional(),
      take: z.number().optional(),
      search: z.string().optional(),
      archived: z.boolean().optional(),
      tenant: z.string().optional(),
      firstResult: z.number().optional(),
      orderBy: z.string().optional(),
      ids: z.array(z.string()).optional(),
      partialName: z.string().optional(),
    },
    {
      title: "List all certificates in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({
      spaceName,
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
  toolName: "list_certificates",
  config: { toolset: "certificates", readOnly: true },
  registerFn: registerListCertificatesTool,
});