import { Client, ReleaseRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

export function registerFindReleasesTool(server: McpServer) {
  server.tool(
    "find_releases",
    `Find releases in a space - can retrieve a single release by ID or list all releases

  This unified tool can either:
  - Get a specific release when releaseId is provided
  - List all releases in a space when releaseId is omitted

  Optionally provide skip and take parameters for pagination when listing.`,
    {
      spaceName: z.string().describe("The space name"),
      releaseId: z.string().optional().describe("The ID of a specific release to retrieve. If omitted, lists all releases."),
      skip: z.number().optional().describe("Number of releases to skip for pagination (only used when listing)"),
      take: z.number().optional().describe("Number of releases to take for pagination (only used when listing)")
    },
    {
      title: "Find releases in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, releaseId, skip, take }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const releaseRepository = new ReleaseRepository(client, spaceName);

      // If releaseId is provided, get a single release
      if (releaseId) {
        validateEntityId(releaseId, 'release', ENTITY_PREFIXES.release);

        try {
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
            helpText: "Use find_releases without releaseId or list_releases_for_project to find valid release IDs."
          });
        }
      }

      // Otherwise, list all releases
      const releasesResponse = await releaseRepository.list({ skip, take });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: releasesResponse.TotalResults,
              itemsPerPage: releasesResponse.ItemsPerPage,
              numberOfPages: releasesResponse.NumberOfPages,
              lastPageNumber: releasesResponse.LastPageNumber,
              items: releasesResponse.Items.map(release => ({
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
              }))
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "find_releases",
  config: { toolset: "releases", readOnly: true },
  registerFn: registerFindReleasesTool,
});
