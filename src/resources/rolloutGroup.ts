import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { registerResourceDescriptor } from "../types/resourceConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  validateEntityId,
  handleOctopusApiError,
} from "../helpers/errorHandling.js";
import { stripLinks } from "../helpers/stripLinks.js";
import { type RolloutGroupResource } from "../types/featureToggleTypes.js";

registerResourceDescriptor({
  name: "rolloutGroup",
  uriTemplate:
    "octopus://spaces/{spaceName}/projects/{projectId}/rolloutgroups/{rolloutGroupId}",
  toolset: "featureToggles",
  title: "Octopus feature toggle rollout group",
  description:
    "Full rollout group body for a given rollout group ID in a project. Lists the feature toggles bound to the group via FeatureToggleUsages. Read-only — this MCP server does not expose rollout group create/modify/delete; use the Octopus UI for those.",
  mimeType: "application/json",
  read: async ({ spaceName, projectId, rolloutGroupId }) => {
    validateEntityId(rolloutGroupId, "rollout group", "RolloutGroups-");

    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const spaceId = await resolveSpaceId(client, spaceName);
      const group = await client.get<RolloutGroupResource>(
        "~/api/{spaceId}/projects/{projectId}/featuretoggles/rollout-groups/{rolloutGroupId}",
        { spaceId, projectId, rolloutGroupId },
      );

      return {
        mimeType: "application/json",
        text: JSON.stringify(stripLinks(group)),
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "rollout group",
        entityId: rolloutGroupId,
        spaceName,
        helpText:
          "Rollout group IDs surface as RolloutGroupId on toggles returned from find_feature_toggles. They are unique per project.",
      });
    }
  },
});
