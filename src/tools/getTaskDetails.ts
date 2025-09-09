import { Client, SpaceServerTaskRepository } from '@octopusdeploy/api-client';
import { z } from 'zod';
import { getClientConfigurationFromEnvironment } from '../helpers/getClientConfigurationFromEnvironment.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface GetTaskDetailsParams {
  space: string;
  taskId: string;
}

export async function getTaskDetails(client: Client, params: GetTaskDetailsParams) {
  const { space, taskId } = params;
  
  if (!taskId) {
    throw new Error("Task ID is required");
  }

  const serverTaskRepository = new SpaceServerTaskRepository(client, space);
  const response = await serverTaskRepository.getDetails(taskId);
  return response;
}

export function registerGetTaskDetailsTool(server: McpServer) {
  server.tool(
    'get_task_details',
    'Get detailed information for a specific server task by its ID',
    { space: z.string(), taskId: z.string() },
    {
      title: 'Get detailed information for a specific server task by its ID',
      readOnlyHint: true,
    },
    async (args) => {
      const { space, taskId } = args as GetTaskDetailsParams;
      
      if (!taskId) {
        throw new Error("Task ID is required");
      }

      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const serverTaskRepository = new SpaceServerTaskRepository(client, space);
      
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