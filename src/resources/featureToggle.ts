import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { registerResourceDescriptor } from "../types/resourceConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";
import { stripLinks } from "../helpers/stripLinks.js";
import { type FeatureToggleResource } from "../types/featureToggleTypes.js";

registerResourceDescriptor({
  name: "featureToggle",
  uriTemplate:
    "octopus://spaces/{spaceName}/projects/{projectId}/featuretoggles/{slug}",
  toolset: "featureToggles",
  title: "Octopus feature toggle",
  description:
    "Full customer feature toggle body for a given slug in a project. Includes per-environment configuration (tenants, segments, minimum versions) that the find_feature_toggles slim summary omits.",
  mimeType: "application/json",
  read: async ({ spaceName, projectId, slug }) => {
    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const spaceId = await resolveSpaceId(client, spaceName);
      const toggle = await client.get<FeatureToggleResource>(
        "~/api/{spaceId}/projects/{projectId}/featuretoggles/{slug}",
        { spaceId, projectId, slug },
      );

      return {
        mimeType: "application/json",
        text: JSON.stringify(stripLinks(toggle)),
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "feature toggle",
        entityId: slug,
        spaceName,
        helpText:
          "Use find_feature_toggles to list valid slugs. If 404 persists across all toggles, the customer feature toggles capability may be disabled on the Octopus instance.",
      });
    }
  },
});
