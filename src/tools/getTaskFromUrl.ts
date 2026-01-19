import { Client, SpaceServerTaskRepository, DeploymentRepository } from '@octopusdeploy/api-client';
import { z } from 'zod';
import { getClientConfigurationFromEnvironment } from '../helpers/getClientConfigurationFromEnvironment.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerToolDefinition } from '../types/toolConfig.js';
import { tasksDescription } from '../types/taskTypes.js';
import { parseOctopusUrl, extractTaskId, extractDeploymentId } from '../helpers/urlParser.js';
import { resolveSpaceNameFromId } from '../helpers/spaceResolver.js';

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

  let taskId = extractTaskId(url);

  if (!taskId) {
    const deploymentId = extractDeploymentId(url);

    if (deploymentId) {
      const deploymentRepository = new DeploymentRepository(client, spaceName);
      const deploymentsResponse = await deploymentRepository.list({});
      const deployment = deploymentsResponse.Items.find(d => d.Id === deploymentId);

      if (!deployment) {
        throw new Error(
          `Deployment ${deploymentId} not found in space "${spaceName}". ` +
          `The URL appears to be a deployment URL, but the task ID must be retrieved ` +
          `from the deployment first.`
        );
      }

      taskId = deployment.TaskId;

      if (!taskId) {
        throw new Error(
          `Deployment ${deploymentId} found but has no associated task ID. ` +
          `This is unusual and may indicate a problem with the deployment.`
        );
      }
    } else {
      throw new Error(
        `Could not extract task ID or deployment ID from URL. ` +
        `URL must contain either a task identifier (ServerTasks-XXXXX) ` +
        `or a deployment identifier (Deployments-XXXXX).`
      );
    }
  }

  const serverTaskRepository = new SpaceServerTaskRepository(client, spaceName);
  const response = await serverTaskRepository.getDetails(taskId);

  return {
    task: response,
    resolvedSpaceName: spaceName,
    resolvedTaskId: taskId,
    urlInfo: {
      originalUrl: url,
      extractedSpaceId: urlParts.spaceId,
      extractedTaskId: extractTaskId(url),
      extractedDeploymentId: extractDeploymentId(url),
      resourceType: urlParts.resourceType,
    }
  };
}

export function registerGetTaskFromUrlTool(server: McpServer) {
  server.tool(
    'get_task_from_url',
    `Get task details from an Octopus Deploy URL. This tool automatically extracts the task ID from the URL, or if given a deployment URL, it will query the deployment to get the task ID first. ${tasksDescription}

This tool handles:
- Task URLs (containing ServerTasks-XXXXX)
- Deployment URLs (containing Deployments-XXXXX) - automatically resolves to the deployment's task
- Automatic space ID to space name resolution`,
    { url: z.string() },
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
