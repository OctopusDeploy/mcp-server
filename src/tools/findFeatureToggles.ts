import {
  Client,
  resolveSpaceId,
  type ResourceCollection,
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import {
  handleOctopusApiError,
  isErrorWithMessage,
} from "../helpers/errorHandling.js";
import {
  type FeatureToggleResource,
  type FeatureToggleEnvironmentResource,
} from "../types/featureToggleTypes.js";

/**
 * Slim per-environment shape returned alongside each toggle. Includes just
 * enough state to answer "where is X turned on, and at what rollout?" without
 * dereferencing the full toggle body. Tenant lists, segments, and minimum
 * versions stay in the resource.
 */
function environmentSummary(env: FeatureToggleEnvironmentResource) {
  return {
    deploymentEnvironmentId: env.DeploymentEnvironmentId,
    isEnabled: env.IsEnabled,
    rolloutPercentage: env.RolloutPercentage,
    clientRolloutPercentage: env.ClientRolloutPercentage,
  };
}

function toggleSummary(toggle: FeatureToggleResource, spaceName: string) {
  const encodedSpace = encodeURIComponent(spaceName);
  const encodedProjectId = encodeURIComponent(toggle.ProjectId);
  const encodedSlug = encodeURIComponent(toggle.Slug);

  return {
    id: toggle.Id,
    slug: toggle.Slug,
    name: toggle.Name,
    projectId: toggle.ProjectId,
    defaultIsEnabled: toggle.DefaultIsEnabled,
    rolloutGroupId: toggle.RolloutGroupId ?? null,
    tags: toggle.Tags ?? [],
    environmentSummaries: (toggle.Environments ?? []).map(environmentSummary),
    resourceUri: `octopus://spaces/${encodedSpace}/projects/${encodedProjectId}/featuretoggles/${encodedSlug}`,
  };
}

const findFeatureTogglesSchema = z.object({
  spaceName: z.string().describe("Space name."),
  projectId: z
    .string()
    .describe(
      "Project ID (e.g. Projects-123). Feature toggles are scoped per project.",
    ),
  partialName: z
    .string()
    .optional()
    .describe("Case-insensitive substring match on the toggle name."),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      'Filter by canonical tag names (e.g. "release-rings/beta"). Repeats: a toggle matches if it has any of these tags.',
    ),
  environmentIds: z
    .array(z.string())
    .optional()
    .describe(
      "Filter by environment IDs (e.g. Environments-7). A toggle matches if it has configuration for any of these environments.",
    ),
  skip: z.number().optional().describe("Pagination offset (≥ 0)."),
  take: z.number().optional().describe("Pagination page size (≤ 100)."),
});

export type FindFeatureTogglesParams = z.infer<typeof findFeatureTogglesSchema>;

export async function findFeatureTogglesHandler(
  params: FindFeatureTogglesParams,
) {
  const { spaceName, projectId, partialName, tags, environmentIds, skip, take } =
    params;

  const client = await Client.create(getClientConfigurationFromEnvironment());

  let spaceId: string;
  try {
    spaceId = await resolveSpaceId(client, spaceName);
  } catch (error) {
    handleOctopusApiError(error, { spaceName });
  }

  try {
    const response = await client.get<ResourceCollection<FeatureToggleResource>>(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles{?Skip,Take,PartialName,Tags,Environments}",
      {
        spaceId,
        projectId,
        Skip: skip,
        Take: take,
        PartialName: partialName,
        Tags: tags,
        Environments: environmentIds,
      },
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            totalResults: response.TotalResults,
            itemsPerPage: response.ItemsPerPage,
            numberOfPages: response.NumberOfPages,
            lastPageNumber: response.LastPageNumber,
            items: (response.Items ?? []).map((toggle) =>
              toggleSummary(toggle, spaceName),
            ),
          }),
        },
      ],
    };
  } catch (error) {
    // 404 at this layer is ambiguous: either feature toggles are disabled on
    // the instance (per the API contract — every route returns 404 when the
    // capability is off), or the projectId is wrong. The space itself was
    // already resolved successfully above. Surface the disabled-capability
    // hint rather than the generic "Space not found" message.
    if (isErrorWithMessage(error, "not found") || isErrorWithMessage(error, "404")) {
      throw new Error(
        `Feature toggles endpoint returned 404 for project '${projectId}' in space '${spaceName}'. ` +
          "Either the customer feature toggles capability is disabled on this Octopus instance, or the projectId is incorrect. " +
          "Use list_projects to verify the project ID.",
      );
    }
    handleOctopusApiError(error, { spaceName });
  }
}

export function registerFindFeatureTogglesTool(server: McpServer) {
  server.registerTool(
    "find_feature_toggles",
    {
      title: "Find feature toggles",
      description: `List customer feature toggles in an Octopus Deploy project.

Each summary includes per-environment state (isEnabled, rolloutPercentage, clientRolloutPercentage) so "where is X turned on" is answerable from the list response. Heavy fields (description, tenant lists, segments, minimum versions) live in the resource body.

Dereference the returned resourceUri (octopus://spaces/{spaceName}/projects/{projectId}/featuretoggles/{slug}) for the full toggle body.

Use update_feature_toggle to flip an environment on/off or change rollout percentages on an existing toggle. This MCP server does not expose toggle creation, deletion, renaming, or rollout-group management — direct customers to the Octopus UI for those.`,
      inputSchema: findFeatureTogglesSchema.shape,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    findFeatureTogglesHandler,
  );
}

registerToolDefinition({
  toolName: "find_feature_toggles",
  config: { toolset: "featureToggles", readOnly: true },
  registerFn: registerFindFeatureTogglesTool,
});
