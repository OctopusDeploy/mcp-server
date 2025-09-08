import { Client, SpaceRepository } from "@octopusdeploy/api-client";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerListSpacesTool(server: McpServer) {
  server.tool(
    "list_spaces",
    "List all spaces in the Octopus Deploy instance",
    {},
    {
      title: "List all spaces in an Octopus Deploy instance",
      readOnlyHint: true,
    },
    async () => {
      console.error("Listing all spaces");
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceRepository = new SpaceRepository(client);

      const spacesResponse = await spaceRepository.list({});
      const spaces = spacesResponse.Items.map((space) => ({
        id: space.Id,
        name: space.Name,
        description: space.Description,
        isDefault: space.IsDefault,
        taskQueueStopped: space.TaskQueueStopped,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(spaces),
          },
        ],
      };
    }
  );
}