import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  type AccountResource,
  mapAccountResource
} from "../types/accountTypes.js";
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

export function registerGetAccountTool(server: McpServer) {
  server.tool(
    "get_account",
    `Get details for a specific account by its ID

This tool retrieves detailed information about a specific account using its ID. The space name and account ID are both required.`,
    {
      spaceName: z.string(),
      accountId: z.string().describe("The ID of the account to retrieve"),
    },
    {
      title: "Get a specific account by ID from an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, accountId }) => {
      validateEntityId(accountId, 'account', ENTITY_PREFIXES.account);

      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const spaceId = await resolveSpaceId(client, spaceName);

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
  );
}

registerToolDefinition({
  toolName: "get_account",
  config: { toolset: "accounts", readOnly: true },
  registerFn: registerGetAccountTool,
});