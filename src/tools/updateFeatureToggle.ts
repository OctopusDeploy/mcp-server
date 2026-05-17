import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";
import {
  requireConfirmation,
  unconfirmedResponse,
} from "../helpers/requireConfirmation.js";
import { zodErrorResponse } from "../helpers/zodErrorResponse.js";
import {
  type FeatureToggleResource,
  type FeatureToggleEnvironmentResource,
} from "../types/featureToggleTypes.js";

const environmentPatchSchema = z.object({
  deploymentEnvironmentId: z
    .string()
    .describe(
      "Targets the existing per-environment configuration to patch (e.g. Environments-7). Must already be configured on the toggle — this tool does not add new environment configurations.",
    ),
  isEnabled: z
    .boolean()
    .optional()
    .describe("Whether the toggle is on for this environment, before targeting/rollout is applied."),
  rolloutPercentage: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Server-side rollout percentage [0, 100]."),
  clientRolloutPercentage: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Client-side fractional rollout evaluated by the SDK [0, 100]."),
});

// SDK workaround: publish a plain `z.object(...)` as `inputSchema`; refinements
// live on `updateFeatureToggleValidationSchema` and run inside the handler.
// See the comment on run_runbook / find_events for the underlying reason.
const updateFeatureToggleRawShape = {
  spaceName: z.string().describe("Space name."),
  projectId: z
    .string()
    .describe("Project ID (e.g. Projects-123). Feature toggles are scoped per project."),
  slug: z
    .string()
    .describe("The toggle's Slug (not its Id). Find it via find_feature_toggles."),
  defaultIsEnabled: z
    .boolean()
    .optional()
    .describe(
      "Toggle-level default. The value returned for environments that have no explicit per-environment configuration.",
    ),
  description: z
    .string()
    .optional()
    .describe("Toggle-level description (max 1000 chars). Markdown supported in the UI."),
  environments: z
    .array(environmentPatchSchema)
    .optional()
    .describe(
      "Per-environment patches. Environments not listed here are preserved as-is. Each entry must reference a deploymentEnvironmentId that already exists on the toggle; unknown environments are rejected rather than silently added. Each environment may appear at most once in this array — duplicates are rejected.",
    ),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Required only when the MCP client does not support elicitation. Set to true to confirm the update; otherwise the tool aborts.",
    ),
};

export const updateFeatureToggleInputSchema = z.object(
  updateFeatureToggleRawShape,
);

export const updateFeatureToggleValidationSchema =
  updateFeatureToggleInputSchema.superRefine((args, ctx) => {
    // Reject duplicate deploymentEnvironmentIds up front. Without this,
    // the merge picks the FIRST patch for the env while the confirmation
    // diff overwrites earlier entries with later ones using the same key —
    // the user could see one change in the prompt and a different one
    // actually go through.
    if (!args.environments) return;
    const seen = new Map<string, number>();
    for (let i = 0; i < args.environments.length; i++) {
      const id = args.environments[i].deploymentEnvironmentId;
      const prev = seen.get(id);
      if (prev !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Duplicate environment entry for '${id}' at index ${i} (also at index ${prev}). ` +
            "Combine the patches into a single entry per environment.",
          path: ["environments", i, "deploymentEnvironmentId"],
        });
      }
      seen.set(id, i);
    }
  });

export type UpdateFeatureToggleParams = z.infer<
  typeof updateFeatureToggleValidationSchema
>;

interface PatchedEnvironment {
  current: FeatureToggleEnvironmentResource;
  merged: FeatureToggleEnvironmentResource;
  changedFields: string[];
}

function applyEnvironmentPatch(
  current: FeatureToggleEnvironmentResource,
  patch: z.infer<typeof environmentPatchSchema>,
): PatchedEnvironment {
  const merged: FeatureToggleEnvironmentResource = { ...current };
  const changedFields: string[] = [];

  if (patch.isEnabled !== undefined && patch.isEnabled !== current.IsEnabled) {
    merged.IsEnabled = patch.isEnabled;
    changedFields.push("IsEnabled");
  }
  if (
    patch.rolloutPercentage !== undefined &&
    patch.rolloutPercentage !== current.RolloutPercentage
  ) {
    merged.RolloutPercentage = patch.rolloutPercentage;
    changedFields.push("RolloutPercentage");
  }
  if (
    patch.clientRolloutPercentage !== undefined &&
    patch.clientRolloutPercentage !== current.ClientRolloutPercentage
  ) {
    merged.ClientRolloutPercentage = patch.clientRolloutPercentage;
    changedFields.push("ClientRolloutPercentage");
  }

  return { current, merged, changedFields };
}

function buildDiffSource(
  toggle: FeatureToggleResource,
  params: UpdateFeatureToggleParams,
  envPatches: PatchedEnvironment[],
): Record<string, unknown> {
  const source: Record<string, unknown> = {};
  if (params.defaultIsEnabled !== undefined) {
    source.DefaultIsEnabled = toggle.DefaultIsEnabled;
  }
  if (params.description !== undefined) {
    source.Description = toggle.Description ?? null;
  }
  for (const patch of envPatches) {
    if (patch.changedFields.length === 0) continue;
    const sourceFields: Record<string, unknown> = {};
    for (const field of patch.changedFields) {
      sourceFields[field] =
        patch.current[field as keyof FeatureToggleEnvironmentResource];
    }
    source[`Environments[${patch.current.DeploymentEnvironmentId}]`] = sourceFields;
  }
  return source;
}

function buildDiffTarget(
  params: UpdateFeatureToggleParams,
  envPatches: PatchedEnvironment[],
): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  if (params.defaultIsEnabled !== undefined) {
    target.DefaultIsEnabled = params.defaultIsEnabled;
  }
  if (params.description !== undefined) {
    target.Description = params.description;
  }
  for (const patch of envPatches) {
    if (patch.changedFields.length === 0) continue;
    const targetFields: Record<string, unknown> = {};
    for (const field of patch.changedFields) {
      targetFields[field] =
        patch.merged[field as keyof FeatureToggleEnvironmentResource];
    }
    target[`Environments[${patch.current.DeploymentEnvironmentId}]`] = targetFields;
  }
  return target;
}

export async function updateFeatureToggleHandler(
  server: McpServer,
  params: UpdateFeatureToggleParams,
) {
  const { spaceName, projectId, slug, environments, confirm } = params;

  const noPatches =
    params.defaultIsEnabled === undefined &&
    params.description === undefined &&
    (!environments || environments.length === 0);
  if (noPatches) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: false,
              reason: "no_patches",
              message:
                "No fields supplied to update. Pass at least one of defaultIsEnabled, description, or environments[].",
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  const client = await Client.create(getClientConfigurationFromEnvironment());

  let spaceId: string;
  try {
    spaceId = await resolveSpaceId(client, spaceName);
  } catch (error) {
    handleOctopusApiError(error, { spaceName });
  }

  let current: FeatureToggleResource;
  try {
    current = await client.get<FeatureToggleResource>(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles/{slug}",
      { spaceId, projectId, slug },
    );
  } catch (error) {
    handleOctopusApiError(error, {
      entityType: "feature toggle",
      entityId: slug,
      spaceName,
      helpText:
        "Use find_feature_toggles to list valid slugs. If 404 persists across all toggles in the project, the customer feature toggles capability may be disabled on the Octopus instance.",
    });
  }

  // Match patch entries to existing environment configurations. Unknown
  // environments are rejected — the contract is "slight adjustment", not
  // "configure new environments".
  const envPatches: PatchedEnvironment[] = [];
  if (environments) {
    for (const patch of environments) {
      const existing = current.Environments.find(
        (e) => e.DeploymentEnvironmentId === patch.deploymentEnvironmentId,
      );
      if (!existing) {
        const configured = current.Environments.map(
          (e) => e.DeploymentEnvironmentId,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  reason: "environment_not_configured",
                  message:
                    `Environment '${patch.deploymentEnvironmentId}' is not configured on toggle '${current.Slug}'. ` +
                    "This tool only adjusts existing environment configurations; it does not add new ones. " +
                    "Use the Octopus UI to add an environment to a toggle.",
                  configuredEnvironmentIds: configured,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
      envPatches.push(applyEnvironmentPatch(existing, patch));
    }
  }

  // Detect a no-op call (everything provided already matches current state)
  // before involving the user with a confirmation dialog.
  const toggleLevelChanges =
    (params.defaultIsEnabled !== undefined &&
      params.defaultIsEnabled !== current.DefaultIsEnabled) ||
    (params.description !== undefined &&
      params.description !== (current.Description ?? undefined));
  const envLevelChanges = envPatches.some((p) => p.changedFields.length > 0);
  if (!toggleLevelChanges && !envLevelChanges) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              noOp: true,
              message:
                "All supplied fields already match the current toggle state — nothing to update.",
              slug: current.Slug,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const merged: FeatureToggleResource = {
    ...current,
    DefaultIsEnabled:
      params.defaultIsEnabled !== undefined
        ? params.defaultIsEnabled
        : current.DefaultIsEnabled,
    Description:
      params.description !== undefined ? params.description : current.Description,
    Environments: current.Environments.map((env) => {
      const patch = envPatches.find(
        (p) => p.current.DeploymentEnvironmentId === env.DeploymentEnvironmentId,
      );
      return patch ? patch.merged : env;
    }),
  };

  const confirmation = await requireConfirmation(server, {
    message: `Update feature toggle "${current.Name}" (${current.Slug}) in space ${spaceName}?`,
    fallbackConfirm: confirm,
    change: {
      source: buildDiffSource(current, params, envPatches),
      target: buildDiffTarget(params, envPatches),
    },
  });
  if (!confirmation.confirmed) {
    return unconfirmedResponse(confirmation, {
      action: "feature toggle update",
    });
  }

  try {
    await client.doUpdate<FeatureToggleResource>(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles",
      merged,
      { spaceId, projectId },
    );
  } catch (error) {
    handleOctopusApiError(error, {
      entityType: "feature toggle",
      entityId: current.Id,
      spaceName,
      helpText:
        "Verify you have FeatureToggleEdit on the project and every environment referenced. Server-side validation rules (max segments, ephemeral environment clamping, etc.) are documented in the Octopus feature toggles API reference.",
    });
  }

  const encodedSpace = encodeURIComponent(spaceName);
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedSlug = encodeURIComponent(current.Slug);
  const resourceUri = `octopus://spaces/${encodedSpace}/projects/${encodedProjectId}/featuretoggles/${encodedSlug}`;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: true,
            id: current.Id,
            slug: current.Slug,
            name: current.Name,
            resourceUri,
            message: `Feature toggle '${current.Slug}' updated successfully.`,
            helpText:
              "Dereference resourceUri to read the updated toggle body.",
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function registerUpdateFeatureToggleTool(server: McpServer) {
  server.registerTool(
    "update_feature_toggle",
    {
      title: "Update a feature toggle",
      description: `Adjust an existing customer feature toggle in an Octopus Deploy project.

Narrow surface — flip an environment on/off, change rollout percentages, or update the toggle-level description / default state. Internally fetches the current toggle, applies your patches in memory, and PUTs the merged body, so unmentioned environments and unmentioned fields are preserved.

Deliberately not exposed: name/slug rename, tag changes, rollout group attach/detach, tenant targeting, segments, minimum version, adding or removing environment configurations entirely. For those, use the Octopus UI.

Patches that reference an environment not already configured on the toggle are rejected with reason: environment_not_configured. The tool does not add new environment configurations.`,
      inputSchema: updateFeatureToggleInputSchema,
      annotations: DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const parsed = updateFeatureToggleValidationSchema.safeParse(args);
      if (!parsed.success) return zodErrorResponse(parsed.error);
      return updateFeatureToggleHandler(server, parsed.data);
    },
  );
}

registerToolDefinition({
  toolName: "update_feature_toggle",
  config: { toolset: "featureToggles", readOnly: false },
  registerFn: registerUpdateFeatureToggleTool,
  minimumOctopusVersion: "2026.1.10655",
});
