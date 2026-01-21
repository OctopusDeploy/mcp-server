import { Client, SpaceRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { spacesDescription } from "../types/spaceTypes.js";

export function registerListSpacesTool(server: McpServer) {
  server.tool(
    "list_spaces",
    `List all spaces in the Octopus Deploy instance. ${spacesDescription} Always use this tool first to check that the requested space exists.`,
    {
      partialName: z.string().optional(),
      skip: z.number().optional(),
      take: z.number().optional()
    },
    {
      title: "List all spaces in an Octopus Deploy instance",
      readOnlyHint: true,
    },
    async ({ partialName, skip, take }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceRepository = new SpaceRepository(client);

      const spacesResponse = await spaceRepository.list({ partialName, skip, take });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: spacesResponse.TotalResults,
              itemsPerPage: spacesResponse.ItemsPerPage,
              numberOfPages: spacesResponse.NumberOfPages,
              lastPageNumber: spacesResponse.LastPageNumber,
              items: spacesResponse.Items.map((space) => ({
                id: space.Id,
                name: space.Name,
                description: space.Description,
                isDefault: space.IsDefault,
                taskQueueStopped: space.TaskQueueStopped,
              }))
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "list_spaces",
  config: { toolset: "core", readOnly: true },
  registerFn: registerListSpacesTool,
});