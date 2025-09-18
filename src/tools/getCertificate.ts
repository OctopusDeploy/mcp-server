import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type CertificateResource, mapCertificateResource } from "../types/certificateTypes.js";

export function registerGetCertificateTool(server: McpServer) {
  server.tool(
    "get_certificate",
    `Get details for a specific certificate by its ID

This tool retrieves detailed information about a specific certificate using its ID. The space name and certificate ID are both required.`,
    {
      spaceName: z.string(),
      certificateId: z.string().describe("The ID of the certificate to retrieve"),
    },
    {
      title: "Get a specific certificate by ID from an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, certificateId }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceId = await resolveSpaceId(client, spaceName);

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
    }
  );
}

registerToolDefinition({
  toolName: "get_certificate",
  config: { toolset: "certificates", readOnly: true },
  registerFn: registerGetCertificateTool,
});