import { Client, ReleaseRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";

export function registerListReleasesTool(server: McpServer) {
  server.tool(
    "list_releases",
    `List releases in a space
  
  This tool lists all releases in a given space. The space name is required. Optionally provide skip and take parameters for pagination.`,
    { 
      space: z.string().describe("The space name"),
      skip: z.number().optional().describe("Number of items to skip for pagination"),
      take: z.number().optional().describe("Number of items to take for pagination")
    },
    {
      title: "List all releases in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ space, skip, take }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const releaseRepository = new ReleaseRepository(client, space);

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