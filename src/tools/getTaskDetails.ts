import { Client, SpaceServerTaskRepository } from '@octopusdeploy/api-client';
import { z } from 'zod';
import { getClientConfigurationFromEnvironment } from '../helpers/getClientConfigurationFromEnvironment.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerToolDefinition } from '../types/toolConfig.js';

export interface GetTaskDetailsParams {
  spaceName: string;
  taskId: string;
}

export async function getTaskDetails(client: Client, params: GetTaskDetailsParams) {
  const { spaceName, taskId } = params;
  
  if (!taskId) {
    throw new Error("Task ID is required");
  }

  const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);
  const response = await serverTaskRepository.getDetails(taskId);
  return response;
}

export function registerGetTaskDetailsTool(server: McpServer) {
  server.tool(
    'get_task_details',
    'Get detailed information for a specific server task by its ID',
    { spaceName: z.string(), taskId: z.string() },
    {
      title: 'Get detailed information for a specific server task by its ID',
      readOnlyHint: true,
    },
    async (args) => {
      const { spaceName, taskId } = args as GetTaskDetailsParams;
      
      if (!taskId) {
        throw new Error("Task ID is required");
      }

      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);
      
      const response = await serverTaskRepository.getDetails(taskId);
      
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
  toolName: "get_task_details",
  config: { toolset: "tasks", readOnly: true },
  registerFn: registerGetTaskDetailsTool
});