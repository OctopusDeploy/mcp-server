import { Client, EnvironmentRepository, type DeploymentEnvironment } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";

export function registerListEnvironmentsTool(server: McpServer) {
  server.tool(
    "list_environments",
    `List environments in a space
  
  This tool lists all environments in a given space. The space name is required. Use this tool as early as possible to understand which environments are configured. Optionally filter by partial name match using partialName parameter.`,
    {
      spaceName: z.string(),
      partialName: z.string().optional(),
      skip: z.number().optional(),
      take: z.number().optional()
    },
    {
      title: "List all environments in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, partialName, skip, take }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const environmentRepository = new EnvironmentRepository(client, spaceName);

      const environmentsResponse = await environmentRepository.list({ partialName, skip, take });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: environmentsResponse.TotalResults,
              itemsPerPage: environmentsResponse.ItemsPerPage,
              numberOfPages: environmentsResponse.NumberOfPages,
              lastPageNumber: environmentsResponse.LastPageNumber,
              items: environmentsResponse.Items.map((environment: DeploymentEnvironment) => ({
                spaceId: environment.SpaceId,
                id: environment.Id,
                name: environment.Name,
                description: environment.Description,
                sortOrder: environment.SortOrder,
                useGuidedFailure: environment.UseGuidedFailure,
                allowDynamicInfrastructure: environment.AllowDynamicInfrastructure,
                extensionSettings: environment.ExtensionSettings,
              }))
            }),
          },
        ],
      };
    }
  );
}


registerToolDefinition({
  toolName: "list_environments",
  config: { toolset: "core", readOnly: true },
  registerFn: registerListEnvironmentsTool,
});