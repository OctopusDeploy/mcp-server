import { Client, ReleaseRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";

export function registerListReleasesForProjectTool(server: McpServer) {
  server.tool(
    "list_releases_for_project",
    `List releases for a specific project
  
  This tool lists all releases for a given project in a space. The space name and project ID are required. Optionally provide skip, take, and searchByVersion parameters.`,
    { 
      space: z.string().describe("The space name"),
      projectId: z.string().describe("The ID of the project to list releases for"),
      skip: z.number().optional().describe("Number of items to skip for pagination"),
      take: z.number().optional().describe("Number of items to take for pagination"),
      searchByVersion: z.string().optional().describe("Search releases by version string")
    },
    {
      title: "List releases for a project in Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ space, projectId, skip, take, searchByVersion }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const releaseRepository = new ReleaseRepository(client, space);

      const releasesResponse = await releaseRepository.listForProject(projectId, { 
        skip, 
        take, 
        searchByVersion 
      });

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