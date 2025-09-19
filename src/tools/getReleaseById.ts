import { Client, ReleaseRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

export function registerGetReleaseByIdTool(server: McpServer) {
  server.tool(
    "get_release_by_id",
    "Get details for a specific release by its ID",
    { 
      spaceName: z.string().describe("The space name"),
      releaseId: z.string().describe("The ID of the release to retrieve")
    },
    {
      title: "Get release details by ID from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ spaceName, releaseId }) => {
      validateEntityId(releaseId, 'release', ENTITY_PREFIXES.release);

      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const releaseRepository = new ReleaseRepository(client, spaceName);

        const release = await releaseRepository.get(releaseId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: release.Id,
                version: release.Version,
                channelId: release.ChannelId,
                projectId: release.ProjectId,
                releaseNotes: release.ReleaseNotes,
                assembled: release.Assembled,
                ignoreChannelRules: release.IgnoreChannelRules,
                selectedPackages: release.SelectedPackages,
                selectedGitResources: release.SelectedGitResources,
                buildInformation: release.BuildInformation,
                customFields: release.CustomFields
              }),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, {
          entityType: 'release',
          entityId: releaseId,
          spaceName,
          helpText: "Use list_releases or list_releases_for_project to find valid release IDs."
        });
      }
    }
  );
}

registerToolDefinition({
  toolName: "get_release_by_id",
  config: { toolset: "releases", readOnly: true },
  registerFn: registerGetReleaseByIdTool,
});