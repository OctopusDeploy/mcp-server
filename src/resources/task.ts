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
    "Lightweight task metadata: state, timing, completion flags, and arguments. Cheap to fetch — use this for polling or status checks. For step timings and embedded log entries, use the /details URI; for the flat plain-text log, use the /log URI.",
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
    "Full ServerTaskDetails payload: the task summary plus Progress, PhysicalLogSize, and the hierarchical ActivityLogs tree (each step's children, status, and embedded log entries). Heavier than the /task summary — fetch when you need step-by-step timings or programmatic access to log entries.",
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

registerResourceDescriptor({
  name: "task-log",
  uriTemplate: "octopus://spaces/{spaceName}/tasks/{taskId}/log",
  toolset: "tasks",
  title: "Octopus task raw activity log",
  description:
    "Raw plain-text task log as displayed in the Octopus portal. Use when you need to grep / read the log linearly. For programmatic access to individual log entries with categories and timestamps, use the /details URI instead.",
  mimeType: "text/plain",
  read: async ({ spaceName, taskId }) => {
    validateEntityId(taskId, "task", ENTITY_PREFIXES.task);

    try {
      const client = await Client.create(
        getClientConfigurationFromEnvironment(),
      );
      const log = await new SpaceServerTaskRepository(client, spaceName).getRaw(
        taskId,
      );

      return {
        mimeType: "text/plain",
        text: log,
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
