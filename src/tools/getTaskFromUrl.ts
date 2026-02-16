import { Client, SpaceServerTaskRepository } from '@octopusdeploy/api-client';
import { z } from 'zod';
import { getClientConfigurationFromEnvironment } from '../helpers/getClientConfigurationFromEnvironment.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerToolDefinition } from '../types/toolConfig.js';
import { tasksDescription } from '../types/taskTypes.js';
import { parseOctopusUrl, extractTaskId } from '../helpers/urlParser.js';
import { resolveSpaceNameFromId } from '../helpers/spaceResolver.js';
import { validateEntityId, ENTITY_PREFIXES } from '../helpers/errorHandling.js';

export interface GetTaskFromUrlParams {
  url: string;
}

export async function getTaskFromUrl(client: Client, params: GetTaskFromUrlParams) {
  const { url } = params;

  if (!url) {
    throw new Error("URL is required");
  }

  const urlParts = parseOctopusUrl(url);

  if (!urlParts.spaceId) {
    throw new Error("Could not extract space ID from URL. URL must contain a space identifier like 'Spaces-1234'");
  }

  const spaceName = await resolveSpaceNameFromId(client, urlParts.spaceId);

  const taskId = extractTaskId(url);

  if (!taskId) {
    throw new Error(
      `Could not extract task ID from URL. ` +
      `URL must contain a task identifier (ServerTasks-XXXXX). ` +
      `If you have a deployment URL, use get_deployment_from_url first to get the task ID, ` +
      `then use get_task_details to view task logs.`
    );
  }

  validateEntityId(taskId, 'task', ENTITY_PREFIXES.task);

  const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);
  const response = await serverTaskRepository.getDetails(taskId);

  return {
    task: response,
    resolvedSpaceName: spaceName,
    resolvedTaskId: taskId,
    urlInfo: {
      originalUrl: url,
      extractedSpaceId: urlParts.spaceId,
      extractedTaskId: taskId,
      resourceType: urlParts.resourceType,
    }
  };
}

export function registerGetTaskFromUrlTool(server: McpServer) {
  server.tool(
    'get_task_from_url',
    `Get task details from an Octopus Deploy task URL. Returns full task details including execution logs and state.

Accepts task URLs like:
https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456

Key features:
- Returns full task details including execution logs
- Handles space ID to space name resolution automatically
- Validates task ID format

For deployment URLs:
If you have a deployment URL, use this workflow:
1. Call get_deployment_from_url with the deployment URL
2. Extract the taskId from the response
3. Call get_task_details with spaceName and taskId to view logs

${tasksDescription}`,
    {
      url: z.string()
        .describe("Full Octopus Deploy task URL containing a task ID (e.g., https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456)")
    },
    {
      title: 'Get task details from an Octopus Deploy URL',
      readOnlyHint: true,
    },
    async (args) => {
      const { url } = args as GetTaskFromUrlParams;

      if (!url) {
        throw new Error("URL is required");
      }

      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);

      const result = await getTaskFromUrl(client, { url });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "get_task_from_url",
  config: { toolset: "tasks", readOnly: true },
  registerFn: registerGetTaskFromUrlTool,
});
