import { Client, SpaceServerTaskRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { tasksDescription } from "../types/taskTypes.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";

export interface GetTaskDetailsParams {
  spaceName: string;
  taskId: string;
}

export async function getTaskDetails(
  client: Client,
  params: GetTaskDetailsParams,
) {
  const { spaceName, taskId } = params;

  validateEntityId(taskId, "task", ENTITY_PREFIXES.task);

  const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);

  try {
    const response = await serverTaskRepository.getDetails(taskId);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw new Error(
        `Task ${taskId} not found in space "${spaceName}". ` +
          `\n\nCommon causes:\n` +
          `1. If you extracted this task ID from a deployment URL, note that deployment URLs do not contain task IDs.\n` +
          `   - Instead, use get_deployment_from_url or get_task_from_url to automatically resolve the correct task ID\n` +
          `2. The task may exist in a different space\n` +
          `3. The task may have been deleted or archived\n` +
          `4. You may not have permission to view this task\n\n` +
          `Tip: Use get_task_from_url if you have an Octopus Deploy URL instead of manually extracting IDs.`,
      );
    }
    throw error;
  }
}

export function registerGetTaskDetailsTool(server: McpServer) {
  server.tool(
    "get_task_details",
    `Get detailed information for a specific server task by its ID. ${tasksDescription}`,
    { spaceName: z.string(), taskId: z.string() },
    {
      title: "Get detailed information for a specific server task by its ID",
      readOnlyHint: true,
    },
    async (args) => {
      const { spaceName, taskId } = args as GetTaskDetailsParams;

      validateEntityId(taskId, "task", ENTITY_PREFIXES.task);

      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);

        const response = await getTaskDetails(client, { spaceName, taskId });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, {
          entityType: "task",
          entityId: taskId,
          spaceName,
          helpText:
            "Use list_deployments or list_releases to find valid task IDs.",
        });
      }
    },
  );
}

registerToolDefinition({
  toolName: "get_task_details",
  config: { toolset: "tasks", readOnly: true },
  registerFn: registerGetTaskDetailsTool,
});
