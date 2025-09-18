import { Client, resolveSpaceId, type ResourceCollection } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  type AccountResource,
  mapAccountResource,
  AccountType
} from "../types/accountTypes.js";

export function registerListAccountsTool(server: McpServer) {
  server.tool(
    "list_accounts",
    `List accounts in a space

This tool lists all accounts in a given space. The space name is required. You can optionally filter by various parameters like name, account type, etc.`,
    {
      spaceName: z.string(),
      skip: z.number().optional(),
      take: z.number().optional(),
      ids: z.array(z.string()).optional(),
      partialName: z.string().optional(),
      accountType: z.nativeEnum(AccountType).optional(),
    },
    {
      title: "List all accounts in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({
      spaceName,
      skip,
      take,
      ids,
      partialName,
      accountType,
    }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceId = await resolveSpaceId(client, spaceName);

      const response = await client.get<ResourceCollection<AccountResource>>(
        "~/api/{spaceId}/accounts{?skip,take,ids,partialName,accountType}",
        {
          spaceId,
          skip,
          take,
          ids,
          partialName,
          accountType,
        }
      );

      const accounts = response.Items.map((account: AccountResource) => mapAccountResource(account));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: response.TotalResults,
              itemsPerPage: response.ItemsPerPage,
              numberOfPages: response.NumberOfPages,
              lastPageNumber: response.LastPageNumber,
              items: accounts,
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "list_accounts",
  config: { toolset: "accounts", readOnly: true },
  registerFn: registerListAccountsTool,
});