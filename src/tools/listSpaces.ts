import { Client, SpaceRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { spacesDescription } from "../types/spaceTypes.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";

export function registerListSpacesTool(server: McpServer) {
  server.tool(
    "list_spaces",
    `List all spaces in the Octopus Deploy instance. ${spacesDescription} Always use this tool first to check that the requested space exists.`,
    { partialName: z.string().optional() },
    {
      title: "List all spaces in an Octopus Deploy instance",
      readOnlyHint: true,
    },
    async ({ partialName }) => {
      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const spaceRepository = new SpaceRepository(client);

        const spacesResponse = await spaceRepository.list({ partialName });
        const spaces = spacesResponse.Items.map((space) => ({
          id: space.Id,
          name: space.Name,
          description: space.Description,
          isDefault: space.IsDefault,
          taskQueueStopped: space.TaskQueueStopped,
        }));

        if (spaces.length === 0) {
          const message = partialName
            ? `No spaces found matching '${partialName}'. Space names are case-sensitive.`
            : "No spaces found. This may indicate a configuration or permission issue.";

          return {
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(spaces),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, {});
      }
    }
  );
}

registerToolDefinition({
  toolName: "list_spaces",
  config: { toolset: "core", readOnly: true },
  registerFn: registerListSpacesTool,
});