import { Client, SpaceServerTaskRepository } from '@octopusdeploy/api-client';
import { z } from 'zod';
import { getClientConfigurationFromEnvironment } from '../helpers/getClientConfigurationFromEnvironment.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerToolDefinition } from '../types/toolConfig.js';

export interface GetTaskByIdParams {
  spaceId: string;
  taskId: string;
}

export async function getTaskById(client: Client, params: GetTaskByIdParams) {
  const { spaceId, taskId } = params;
  
  if (!taskId) {
    throw new Error("Task ID is required");
  }

  const serverTaskRepository = new SpaceServerTaskRepository(client, spaceId);
  const response = await serverTaskRepository.getById(taskId);
  return response;
}

export function registerGetTaskByIdTool(server: McpServer) {
  server.tool(
    'get_task_by_id',
    'Get details for a specific server task by its ID',
    { spaceId: z.string(), taskId: z.string() },
    {
      title: 'Get details for a specific server task by its ID',
      readOnlyHint: true,
    },
    async (args) => {
      const { spaceId, taskId } = args as GetTaskByIdParams;
      
      if (!taskId) {
        throw new Error("Task ID is required");
      }

      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const serverTaskRepository = new SpaceServerTaskRepository(client, spaceId);
      
      const response = await serverTaskRepository.getById(taskId);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "get_task_by_id",
  config: { toolset: "tasks", readOnly: true },
  registerFn: registerGetTaskByIdTool
});