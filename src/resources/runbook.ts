import {
  Client,
  ProjectRepository,
  RunbookRepository,
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
    "Full runbook object for a given runbook ID in a space (DB-backed projects). Body shape mirrors the find_runbooks tool output for a single runbook, plus runtime policy fields (ConnectivityPolicy, DefaultGuidedFailureMode, RunRetentionPolicy) that the slim summary omits. For Config-as-Code runbooks see the runbook-git URI form.",
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

registerResourceDescriptor({
  name: "runbook-git",
  uriTemplate:
    "octopus://spaces/{spaceName}/projects/{projectSlug}/{gitRef}/runbooks/{runbookSlug}",
  toolset: "runbooks",
  title: "Octopus runbook (Config-as-Code)",
  description:
    "Full runbook object for a Config-as-Code runbook at a specific gitRef. Body shape mirrors the find_runbooks tool output for a single runbook, plus runtime policy fields. The DB-backed form is the runbook URI without project/gitRef segments.",
  mimeType: "application/json",
  read: async ({ spaceName, projectSlug, gitRef, runbookSlug }) => {
    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const project = await new ProjectRepository(client, spaceName).get(
        projectSlug,
      );
      const runbookRepository = new RunbookRepository(
        client,
        spaceName,
        project,
      );
      const runbook = await runbookRepository.getWithGitRef(
        runbookSlug,
        gitRef,
      );

      return {
        mimeType: "application/json",
        text: JSON.stringify(stripLinks(runbook)),
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "runbook",
        entityId: runbookSlug,
        spaceName,
        helpText:
          "Use find_runbooks with the same gitRef to find valid CaC runbook slugs.",
      });
    }
  },
});
