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
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

export function registerFindAccountsTool(server: McpServer) {
  server.tool(
    "find_accounts",
    `Find accounts in a space - can retrieve a single account by ID or list all accounts

This unified tool can either:
- Get detailed information about a specific account when accountId is provided
- List all accounts in a space when accountId is omitted

You can optionally filter by various parameters like name, account type, etc. when listing.`,
    {
      spaceName: z.string(),
      accountId: z.string().optional().describe("The ID of a specific account to retrieve. If omitted, lists all accounts."),
      skip: z.number().optional().describe("Number of accounts to skip for pagination (only used when listing)"),
      take: z.number().optional().describe("Number of accounts to take for pagination (only used when listing)"),
      ids: z.array(z.string()).optional().describe("Filter by specific account IDs (only used when listing)"),
      partialName: z.string().optional().describe("Filter by partial name match (only used when listing)"),
      accountType: z.nativeEnum(AccountType).optional().describe("Filter by account type (only used when listing)"),
    },
    {
      title: "Find accounts in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({
      spaceName,
      accountId,
      skip,
      take,
      ids,
      partialName,
      accountType,
    }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceId = await resolveSpaceId(client, spaceName);

      // If accountId is provided, get a single account
      if (accountId) {
        validateEntityId(accountId, 'account', ENTITY_PREFIXES.account);

        try {
          const response = await client.get<AccountResource>(
            "~/api/{spaceId}/accounts/{id}",
            {
              spaceId,
              id: accountId,
            }
          );

          const account = mapAccountResource(response);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(account),
              },
            ],
          };
        } catch (error) {
          handleOctopusApiError(error, {
            entityType: 'account',
            entityId: accountId,
            spaceName
          });
        }
      }

      // Otherwise, list all accounts
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
  toolName: "find_accounts",
  config: { toolset: "accounts", readOnly: true },
  registerFn: registerFindAccountsTool,
});
