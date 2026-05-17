import { Client, ReleaseRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { zodErrorResponse } from "../helpers/zodErrorResponse.js";
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

// SDK workaround: publish a plain `z.object(...)` as `inputSchema`; refinements
// live on `findReleasesValidationSchema` and run inside the handler. See the
// comment on run_runbook / find_events for the underlying reason.
const findReleasesRawShape = {
  spaceName: z.string().describe("Space name."),
  releaseId: z
    .string()
    .optional()
    .describe(
      "Fetch a single release by ID. Mutually exclusive with projectId and searchByVersion.",
    ),
  projectId: z
    .string()
    .optional()
    .describe("Restrict listing to a single project. Mutually exclusive with releaseId."),
  searchByVersion: z
    .string()
    .optional()
    .describe("Filter by version string. Requires projectId."),
  skip: z.number().optional().describe("Pagination offset."),
  take: z.number().optional().describe("Pagination page size."),
};

export const findReleasesInputSchema = z.object(findReleasesRawShape);

export const findReleasesValidationSchema = findReleasesInputSchema.superRefine(
  (args, ctx) => {
    if (args.releaseId && args.projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide either releaseId or projectId, not both. Use releaseId to fetch a single release; use projectId to list releases for a project.",
        path: ["projectId"],
      });
    }
    if (args.searchByVersion && !args.projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "searchByVersion requires projectId.",
        path: ["searchByVersion"],
      });
    }
    if (args.releaseId && args.searchByVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "searchByVersion is only valid when listing releases for a project; it cannot be combined with releaseId.",
        path: ["searchByVersion"],
      });
    }
  },
);

export function registerFindReleasesTool(server: McpServer) {
  server.registerTool(
    "find_releases",
    {
      title: "Find releases",
      description: `Find releases in an Octopus Deploy space.

  Three modes, picked by which arguments are supplied:
  - releaseId  → fetch the summary for that release.
  - projectId  → list releases for that project (optionally filtered by searchByVersion).
  - neither    → list releases across the space.

  Each summary includes a resourceUri for fetching the full release body
  (release notes, packages, build information, custom fields).`,
      inputSchema: findReleasesInputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const parsed = findReleasesValidationSchema.safeParse(args);
      if (!parsed.success) return zodErrorResponse(parsed.error);
      const { spaceName, releaseId, projectId, searchByVersion, skip, take } =
        parsed.data;
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
