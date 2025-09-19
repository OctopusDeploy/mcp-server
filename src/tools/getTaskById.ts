import { Client, SpaceServerTaskRepository } from '@octopusdeploy/api-client';
import { z } from 'zod';
import { getClientConfigurationFromEnvironment } from '../helpers/getClientConfigurationFromEnvironment.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerToolDefinition } from '../types/toolConfig.js';
import { tasksDescription } from '../types/taskTypes.js';
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from '../helpers/errorHandling.js';

export interface GetTaskByIdParams {
  spaceName: string;
  taskId: string;
}

export async function getTaskById(client: Client, params: GetTaskByIdParams) {
  const { spaceName, taskId } = params;

  validateEntityId(taskId, 'task', ENTITY_PREFIXES.task);

  const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);
  const response = await serverTaskRepository.getById(taskId);
  return response;
}

export function registerGetTaskByIdTool(server: McpServer) {
  server.tool(
    'get_task_by_id',
    `Get details for a specific server task by its ID. ${tasksDescription}`,
    { spaceName: z.string(), taskId: z.string() },
    {
      title: 'Get details for a specific server task by its ID',
      readOnlyHint: true,
    },
    async (args) => {
      const { spaceName, taskId } = args as GetTaskByIdParams;

      validateEntityId(taskId, 'task', ENTITY_PREFIXES.task);

      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);

        const response = await serverTaskRepository.getById(taskId);

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
          entityType: 'task',
          entityId: taskId,
          spaceName,
          helpText: "Use list_deployments or list_releases to find valid task IDs."
        });
      }
    }
  );
}

registerToolDefinition({
  toolName: "get_task_by_id",
  config: { toolset: "tasks", readOnly: true },
  registerFn: registerGetTaskByIdTool,
});