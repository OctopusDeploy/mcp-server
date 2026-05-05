import { Client, ReleaseRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";

type Release = Awaited<ReturnType<ReleaseRepository["get"]>>;

/**
 * Slim release shape returned by find_releases.
 *
 * Heavy fields (releaseNotes, selectedPackages, selectedGitResources,
 * buildInformation, customFields) are deliberately omitted. Callers fetch
 * the `resourceUri` (octopus://spaces/{spaceName}/releases/{releaseId})
 * Resource for the full body when needed.
 */
function releaseSummary(release: Release, spaceName: string) {
  const encodedSpace = encodeURIComponent(spaceName);
  const encodedId = encodeURIComponent(release.Id);

  return {
    id: release.Id,
    version: release.Version,
    channelId: release.ChannelId,
    projectId: release.ProjectId,
    assembled: release.Assembled,
    ignoreChannelRules: release.IgnoreChannelRules,
    versionControlReference: release.VersionControlReference,
    resourceUri: `octopus://spaces/${encodedSpace}/releases/${encodedId}`,
  };
}

export function registerFindReleasesTool(server: McpServer) {
  server.tool(
    "find_releases",
    `Find releases in an Octopus Deploy space.

  Three modes, picked by which arguments are supplied:
  - releaseId  → fetch the summary for that release.
  - projectId  → list releases for that project (optionally filtered by searchByVersion).
  - neither    → list releases across the space.

  Each summary includes a resourceUri for fetching the full release body
  (release notes, packages, build information, custom fields).`,
    {
      spaceName: z.string().describe("Space name."),
      releaseId: z
        .string()
        .optional()
        .describe("Fetch a single release by ID. Mutually exclusive with projectId."),
      projectId: z
        .string()
        .optional()
        .describe("Restrict listing to a single project."),
      searchByVersion: z
        .string()
        .optional()
        .describe(
          "Filter by version string. Only applied when projectId is supplied.",
        ),
      skip: z.number().optional().describe("Pagination offset."),
      take: z.number().optional().describe("Pagination page size."),
    },
    {
      title: "Find releases",
      readOnlyHint: true,
    },
    async ({ spaceName, releaseId, projectId, searchByVersion, skip, take }) => {
      const client = await Client.create(getClientConfigurationFromEnvironment());
      const releaseRepository = new ReleaseRepository(client, spaceName);

      if (releaseId) {
        validateEntityId(releaseId, "release", ENTITY_PREFIXES.release);

        try {
          const release = await releaseRepository.get(releaseId);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(releaseSummary(release, spaceName)),
              },
            ],
          };
        } catch (error) {
          handleOctopusApiError(error, {
            entityType: "release",
            entityId: releaseId,
            spaceName,
            helpText: "Call find_releases without releaseId to list valid IDs.",
          });
        }
      }

      const releasesResponse = projectId
        ? await releaseRepository.listForProject(projectId, {
            skip,
            take,
            searchByVersion,
          })
        : await releaseRepository.list({ skip, take });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: releasesResponse.TotalResults,
              itemsPerPage: releasesResponse.ItemsPerPage,
              numberOfPages: releasesResponse.NumberOfPages,
              lastPageNumber: releasesResponse.LastPageNumber,
              items: releasesResponse.Items.map((release) =>
                releaseSummary(release, spaceName),
              ),
            }),
          },
        ],
      };
    },
  );
}

registerToolDefinition({
  toolName: "find_releases",
  config: { toolset: "releases", readOnly: true },
  registerFn: registerFindReleasesTool,
});
