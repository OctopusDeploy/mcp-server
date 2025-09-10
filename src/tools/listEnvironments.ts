import { Client, EnvironmentRepository, type DeploymentEnvironment } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";

export function registerListEnvironmentsTool(server: McpServer) {
  server.tool(
    "list_environments",
    `List environments in a space
  
  This tool lists all environments in a given space. The space name is required. Use this tool as early as possible to understand which environments are configured. Optionally filter by partial name match using partialName parameter.`,
    { space: z.string(), partialName: z.string().optional() },
    {
      title: "List all environments in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ space, partialName }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const environmentRepository = new EnvironmentRepository(client, space);

      const environmentsResponse = await environmentRepository.list({ partialName });
      const environments = environmentsResponse.Items.map((environment: DeploymentEnvironment) => ({
        spaceId: environment.SpaceId,
        id: environment.Id,
        name: environment.Name,
        description: environment.Description,
        sortOrder: environment.SortOrder,
        useGuidedFailure: environment.UseGuidedFailure,
        allowDynamicInfrastructure: environment.AllowDynamicInfrastructure,
        extensionSettings: environment.ExtensionSettings,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(environments),
          },
        ],
      };
    }
  );
}