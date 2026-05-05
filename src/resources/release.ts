import { Client, ReleaseRepository } from "@octopusdeploy/api-client";
import { registerResourceDescriptor } from "../types/resourceConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";
import { stripLinks } from "../helpers/stripLinks.js";

registerResourceDescriptor({
  name: "release",
  uriTemplate: "octopus://spaces/{spaceName}/releases/{releaseId}",
  toolset: "releases",
  title: "Octopus release",
  description:
    "Full release object for a given release ID in a space. Body shape mirrors the find_releases tool output for a single release.",
  mimeType: "application/json",
  read: async ({ spaceName, releaseId }) => {
    validateEntityId(releaseId, "release", ENTITY_PREFIXES.release);

    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const release = await new ReleaseRepository(client, spaceName).get(
        releaseId,
      );

      return {
        mimeType: "application/json",
        text: JSON.stringify(stripLinks(release)),
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "release",
        entityId: releaseId,
        spaceName,
        helpText:
          "Use find_releases to find valid release IDs.",
      });
    }
  },
});
