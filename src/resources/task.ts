import { Client, SpaceServerTaskRepository } from "@octopusdeploy/api-client";
import { registerResourceDescriptor } from "../types/resourceConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";
import { stripLinks } from "../helpers/stripLinks.js";

const TASK_HELP_TEXT =
  "Use find_releases or list_deployments to find tasks via their parent entity, or get_deployment_from_url / get_task_from_url for URL-based lookups.";

registerResourceDescriptor({
  name: "task",
  uriTemplate: "octopus://spaces/{spaceName}/tasks/{taskId}",
  toolset: "tasks",
  title: "Octopus task summary",
  description:
    "Lightweight task metadata: state, timing, completion flags, and arguments. Cheap to fetch — use this for polling or status checks. For the full ActivityLogs tree and step timings use the /details URI (same body returned by get_task_from_url when starting from a portal URL); to search the raw activity log call the grep_task_log tool.",
  mimeType: "application/json",
  read: async ({ spaceName, taskId }) => {
    validateEntityId(taskId, "task", ENTITY_PREFIXES.task);

    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const task = await new SpaceServerTaskRepository(client, spaceName).getById(
        taskId,
      );

      return {
        mimeType: "application/json",
        text: JSON.stringify(stripLinks(task)),
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "task",
        entityId: taskId,
        spaceName,
        helpText: TASK_HELP_TEXT,
      });
    }
  },
});

registerResourceDescriptor({
  name: "task-details",
  uriTemplate: "octopus://spaces/{spaceName}/tasks/{taskId}/details",
  toolset: "tasks",
  title: "Octopus task details (structured activity tree)",
  description:
    "Full ServerTaskDetails payload: the task summary plus Progress, PhysicalLogSize, and the hierarchical ActivityLogs tree (each step's children, status, and embedded log entries). Heavier than the /task summary — fetch when you need step-by-step timings or programmatic access to log entries. `get_task_from_url` returns this same body when starting from a portal URL; don't double-fetch.",
  mimeType: "application/json",
  read: async ({ spaceName, taskId }) => {
    validateEntityId(taskId, "task", ENTITY_PREFIXES.task);

    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const details = await new SpaceServerTaskRepository(
        client,
        spaceName,
      ).getDetails(taskId);

      return {
        mimeType: "application/json",
        text: JSON.stringify(stripLinks(details)),
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "task",
        entityId: taskId,
        spaceName,
        helpText: TASK_HELP_TEXT,
      });
    }
  },
});

// NOTE: There is intentionally no `octopus://spaces/{spaceName}/tasks/{taskId}/log`
// resource. Activity logs can be multi-megabyte; exposing them as an addressable
// resource invites agents to fetch the whole body when they only need a few
// matching lines. Use the `grep_task_log` tool instead — its parameters mirror
// GNU grep and it returns only matching slices with totalMatches/context.
// For structured log entries with categories and timestamps, use the /details
// URI above (it embeds ActivityLogs[] inline).
