import { Client, SpaceServerTaskRepository } from '@octopusdeploy/api-client';
import { z } from 'zod';
import { getClientConfigurationFromEnvironment } from '../helpers/getClientConfigurationFromEnvironment.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerToolDefinition } from '../types/toolConfig.js';

export interface GetTaskRawParams {
  spaceName: string;
  taskId: string;
}

export async function getTaskRaw(client: Client, params: GetTaskRawParams) {
  const { spaceName, taskId } = params;
  
  if (!taskId) {
    throw new Error("Task ID is required");
  }

  const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);
  const response = await serverTaskRepository.getRaw(taskId);
  return response;
}

export function registerGetTaskRawTool(server: McpServer) {
  server.tool(
    'get_task_raw',
    'Get raw details for a specific server task by its ID',
    { spaceName: z.string(), taskId: z.string() },
    {
      title: 'Get raw details for a specific server task by its ID',
      readOnlyHint: true,
    },
    async (args) => {
      const { spaceName, taskId } = args as GetTaskRawParams;
      
      if (!taskId) {
        throw new Error("Task ID is required");
      }

      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);
      
      const response = await serverTaskRepository.getRaw(taskId);
      
      return {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "get_task_raw",
  config: { toolset: "tasks", readOnly: true },
  registerFn: registerGetTaskRawTool
});