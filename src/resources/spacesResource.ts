import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { Client, SpaceRepository } from "@octopusdeploy/api-client";

export function registerSpacesResource(server: McpServer) {
  const config = getClientConfigurationFromEnvironment();
  const instanceURL = new URL(config.instanceURL);

  server.resource(
    "octopus_space",
    new ResourceTemplate(`octopus://${instanceURL.host}/spaces/{name}`, {
      list: async () => {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const spaceRepository = new SpaceRepository(client);

        const spacesResponse = await spaceRepository.list({});
        return {
          resources: spacesResponse.Items.map((space) => {
            return {
              uri: `octopus://${instanceURL.host}/spaces/${space.Name}`,
              name: space.Name,
              description: space.Description || "",
            };
          }),
        };
      },
      complete: {
        name: async (name) => {
          const configuration = getClientConfigurationFromEnvironment();
          const client = await Client.create(configuration);
          const spaceRepository = new SpaceRepository(client);
          const spaces = await spaceRepository.list({ partialName: name });
          return spaces.Items.map((space) => space.Name);
        },
      },
    }),
    {},
    async (uri: URL, { name }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceRepository = new SpaceRepository(client);
      const partialName = Array.isArray(name) ? name[0] : name;
      const decodedName = decodeURIComponent(partialName);
      const spaces = await spaceRepository.list({ partialName: decodedName });
      if (spaces.Items.length === 0) {
        throw new Error(`Space with name '${partialName}' not found`);
      }

      const space = spaces.Items[0];

      return {
        contents: [
          {
            uri: uri.toString(),
            text: JSON.stringify(space),
            mimeType: "application/json",
          },
        ],
      };
    }
  );
}