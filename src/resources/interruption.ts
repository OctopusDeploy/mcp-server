import { Client, resolveSpaceId } from "@octopusdeploy/api-client";
import { registerResourceDescriptor } from "../types/resourceConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";
import { stripLinks } from "../helpers/stripLinks.js";

registerResourceDescriptor({
  name: "interruption",
  uriTemplate: "octopus://spaces/{spaceName}/interruptions/{interruptionId}",
  toolset: "interruptions",
  title: "Octopus interruption",
  description:
    "Full interruption body for a given interruption ID in a space. Includes Form.Elements (the form definition with control types, labels, button options, and Paragraph instructions in Markdown) and Form.Values (any already-submitted values), plus RelatedDocumentIds, ResponsibleTeamIds, ResponsibleUserId, and the responsibility flags. Use this when the find_interruptions slim summary is not enough — for example, when the user wants to see the intervention's instructions or the set of choices on the SubmitButtonGroup.",
  mimeType: "application/json",
  read: async ({ spaceName, interruptionId }) => {
    validateEntityId(interruptionId, "interruption", ENTITY_PREFIXES.interruption);

    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const spaceId = await resolveSpaceId(client, spaceName);
      const interruption = await client.get<object>(
        "~/api/{spaceId}/interruptions/{interruptionId}",
        { spaceId, interruptionId },
      );

      return {
        mimeType: "application/json",
        text: JSON.stringify(stripLinks(interruption)),
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "interruption",
        entityId: interruptionId,
        spaceName,
        helpText: "Use find_interruptions to find valid interruption IDs.",
      });
    }
  },
});
