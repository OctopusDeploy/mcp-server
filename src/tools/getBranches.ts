import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { getProjectBranches } from "../helpers/vcsProjectHelpers.js";

export function registerGetBranchesTool(server: McpServer) {
  server.tool(
    "get_branches",
    `Get Git branches for a version-controlled project

This tool retrieves Git branches for a specific project in a space. The space name and project ID are required. Optionally provide searchByName, skip, and take parameters for filtering and pagination.`,
    {
      spaceName: z.string(),
      projectId: z.string(),
      searchByName: z.string().optional(),
      skip: z.number().optional(),
      take: z.number().optional(),
    },
    {
      title: "Get Git branches for a version-controlled project",
      readOnlyHint: true,
    },
    async ({ spaceName, projectId, searchByName, skip, take }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const spaceId = await resolveSpaceId(client, spaceName);

      const options = {
        searchByName,
        skip,
        take,
      };

      const branches = await getProjectBranches(client, spaceId, projectId, options);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              Items: branches.Items.map(branch => ({
                Name: branch.Name,
                IsProtected: branch.IsProtected,
                CanonicalName: branch.CanonicalName,
              })),
              TotalResults: branches.TotalResults,
              ItemsPerPage: branches.ItemsPerPage,
              NumberOfPages: branches.NumberOfPages,
              LastPageNumber: branches.LastPageNumber,
              ItemType: branches.ItemType,
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "get_branches",
  config: { toolset: "context", readOnly: true },
  registerFn: registerGetBranchesTool
});