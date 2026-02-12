import {
  Client,
  EnvironmentRepository,
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";

export function registerListEnvironmentsTool(server: McpServer) {
  server.tool(
    "list_environments",
    `List environments in a space

  This tool lists all environments in a given space. The space name is required. Use this tool as early as possible to understand which environments are configured. Optionally filter by partial name match using partialName parameter.`,
    {
      spaceName: z.string(),
      partialName: z.string().optional(),
      skip: z.number().optional(),
      take: z.number().optional(),
    },
    {
      title: "List all environments in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, partialName, skip, take }) => {
      return fetchEnvironments({ spaceName, partialName, skip, take })
    },
  );
}

interface FetchEnvironmentsParams {
  spaceName: string;
  partialName?: string;
  skip?: number;
  take?: number;
}

export async function fetchEnvironments({ spaceName, partialName, skip, take }: FetchEnvironmentsParams) {
  try {
    const configuration = getClientConfigurationFromEnvironment();
    const client = await Client.create(configuration);
    const environmentRepository = new EnvironmentRepository(
      client,
      spaceName,
    );

    const environmentsResponse = await environmentRepository.list({
      partialName,
      skip,
      take,
    });

    if (environmentsResponse.Items.length === 0) {
      const message = partialName
        ? `No environments found matching '${partialName}' in space '${spaceName}'. Environment names are case-sensitive.`
        : `No environments found in space '${spaceName}'. This space may not have any environments configured.`;

      return {
        content: [
          {
            type: "text" as const,
            text: message,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            totalResults: environmentsResponse.TotalResults,
            itemsPerPage: environmentsResponse.ItemsPerPage,
            numberOfPages: environmentsResponse.NumberOfPages,
            lastPageNumber: environmentsResponse.LastPageNumber,
            items: environmentsResponse.Items.map(
              (environment) => ({
                spaceId: environment.SpaceId,
                id: environment.Id,
                name: environment.Name,
                description: environment.Description,
                sortOrder: environment.SortOrder,
                useGuidedFailure: environment.UseGuidedFailure,
                allowDynamicInfrastructure: environment.AllowDynamicInfrastructure,
                extensionSettings: environment.ExtensionSettings,
              }),
            ),
          }),
        },
      ],
    };
  } catch (error) {
    return handleOctopusApiError(error, { spaceName });
  }
}

registerToolDefinition({
  toolName: "list_environments",
  config: { toolset: "core", readOnly: true },
  registerFn: registerListEnvironmentsTool,
});
