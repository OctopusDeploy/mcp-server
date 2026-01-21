import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { getProjectBranches } from "../helpers/vcsProjectHelpers.js";
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

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
      validateEntityId(projectId, 'project', ENTITY_PREFIXES.project);

      const options = {
        searchByName,
        skip,
        take,
      };

      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const spaceId = await resolveSpaceId(client, spaceName);

        const branches = await getProjectBranches(client, spaceId, projectId, options);

        if (branches.Items.length === 0 && !searchByName) {
          throw new Error(
            `No branches found for project '${projectId}'. This may indicate that the project is not version controlled or ` +
            "uses database storage instead of Git. Only version controlled projects have branches."
          );
        }

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
      } catch (error) {
        handleOctopusApiError(error, {
          entityType: 'project',
          entityId: projectId,
          spaceName
        });
      }
    }
  );
}

registerToolDefinition({
  toolName: "get_branches",
  config: { toolset: "context", readOnly: true },
  registerFn: registerGetBranchesTool,
  minimumOctopusVersion: "2021.2",
});