import { Client } from "@octopusdeploy/api-client";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";

interface CurrentUser {
  Id: string;
  Username: string;
  DisplayName: string;
  IsActive: boolean;
  IsService: boolean;
  EmailAddress: string;
  CanPasswordBeEdited: boolean;
  IsRequestor: boolean;
}

export function registerGetCurrentUserTool(server: McpServer) {
  server.tool(
    "get_current_user",
    `Get information about the current authenticated user

This tool retrieves information about the currently authenticated user from the Octopus Deploy API.`,
    {},
    {
      title: "Get current user information",
      readOnlyHint: true,
    },
    async () => {
      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);

        const user = await client.get<CurrentUser>("~/api/users/me");

        const currentUser = {
          id: user.Id,
          username: user.Username,
          displayName: user.DisplayName,
          isActive: user.IsActive,
          isService: user.IsService,
          emailAddress: user.EmailAddress,
          canPasswordBeEdited: user.CanPasswordBeEdited,
          isRequestor: user.IsRequestor,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(currentUser),
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
  toolName: "get_current_user",
  config: { toolset: "context", readOnly: true },
  registerFn: registerGetCurrentUserTool,
});