import {
  Client,
  resolveSpaceId,
  type Runbook,
} from "@octopusdeploy/api-client";
import { registerResourceDescriptor } from "../types/resourceConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";
import { stripLinks } from "../helpers/stripLinks.js";

registerResourceDescriptor({
  name: "runbook",
  uriTemplate: "octopus://spaces/{spaceName}/runbooks/{runbookId}",
  toolset: "runbooks",
  title: "Octopus runbook",
  description:
    "Full runbook object for a given runbook ID in a space. Body shape mirrors the find_runbooks tool output for a single runbook, plus runtime policy fields (ConnectivityPolicy, DefaultGuidedFailureMode, RunRetentionPolicy) that the slim summary omits.",
  mimeType: "application/json",
  read: async ({ spaceName, runbookId }) => {
    validateEntityId(runbookId, "runbook", ENTITY_PREFIXES.runbook);

    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const spaceId = await resolveSpaceId(client, spaceName);
      const runbook = await client.get<Runbook>(
        "~/api/{spaceId}/runbooks/{id}",
        { spaceId, id: runbookId },
      );

      return {
        mimeType: "application/json",
        text: JSON.stringify(stripLinks(runbook)),
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "runbook",
        entityId: runbookId,
        spaceName,
        helpText: "Use find_runbooks to find valid runbook IDs.",
      });
    }
  },
});
