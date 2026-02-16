import { Client, DeploymentRepository, ReleaseRepository, type Deployment } from '@octopusdeploy/api-client';
import { z } from 'zod';
import { getClientConfigurationFromEnvironment } from '../helpers/getClientConfigurationFromEnvironment.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerToolDefinition } from '../types/toolConfig.js';
import { parseOctopusUrl, extractDeploymentId } from '../helpers/urlParser.js';
import { resolveSpaceNameFromId } from '../helpers/spaceResolver.js';
import { getPublicUrl } from '../helpers/getPublicUrl.js';
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from '../helpers/errorHandling.js';

export interface GetDeploymentFromUrlParams {
  url: string;
}

export async function getDeploymentFromUrl(client: Client, params: GetDeploymentFromUrlParams) {
  const { url } = params;

  if (!url) {
    throw new Error("URL is required");
  }

  const urlParts = parseOctopusUrl(url);

  if (!urlParts.spaceId) {
    throw new Error("Could not extract space ID from URL. URL must contain a space identifier like 'Spaces-1234'");
  }

  const spaceName = await resolveSpaceNameFromId(client, urlParts.spaceId);

  const deploymentId = extractDeploymentId(url);

  if (!deploymentId) {
    throw new Error(
      `Could not extract deployment ID from URL. ` +
      `URL must contain a deployment identifier (Deployments-XXXXX). ` +
      `The provided URL appears to be: ${urlParts.resourceType || 'unknown type'}`
    );
  }

  validateEntityId(deploymentId, 'deployment', ENTITY_PREFIXES.deployment);

  const deploymentRepository = new DeploymentRepository(client, spaceName);
  let deployment: Deployment;
  try {
    deployment = await deploymentRepository.get(deploymentId);
  } catch (error) {
    handleOctopusApiError(error, {
      entityType: 'deployment',
      entityId: deploymentId,
      spaceName,
      helpText: 'The deployment may have been deleted or you may not have permission to view it. Use list_deployments to find valid deployment IDs.'
    });
  }

  let releaseVersion: string | undefined;
  if (deployment.ReleaseId) {
    const releaseRepository = new ReleaseRepository(client, spaceName);
    try {
      const release = await releaseRepository.get(deployment.ReleaseId);
      releaseVersion = release.Version;
    } catch {
      releaseVersion = undefined;
    }
  }

  const configuration = getClientConfigurationFromEnvironment();
  const publicUrl = releaseVersion
    ? getPublicUrl(
        `${configuration.instanceURL}/app#/{spaceId}/projects/{projectId}/deployments/releases/{releaseVersion}/deployments/{deploymentId}`,
        {
          spaceId: deployment.SpaceId,
          projectId: deployment.ProjectId,
          releaseVersion,
          deploymentId: deployment.Id,
        }
      )
    : undefined;

  return {
    deployment: {
      spaceId: deployment.SpaceId,
      id: deployment.Id,
      name: deployment.Name,
      releaseId: deployment.ReleaseId,
      releaseVersion,
      environmentId: deployment.EnvironmentId,
      tenantId: deployment.TenantId,
      projectId: deployment.ProjectId,
      channelId: deployment.ChannelId,
      created: deployment.Created,
      taskId: deployment.TaskId,
      deploymentProcessId: deployment.DeploymentProcessId,
      comments: deployment.Comments,
      formValues: deployment.FormValues,
      queueTime: deployment.QueueTime,
      queueTimeExpiry: deployment.QueueTimeExpiry,
      useGuidedFailure: deployment.UseGuidedFailure,
      specificMachineIds: deployment.SpecificMachineIds,
      excludedMachineIds: deployment.ExcludedMachineIds,
      skipActions: deployment.SkipActions,
      forcePackageDownload: deployment.ForcePackageDownload,
      forcePackageRedeployment: deployment.ForcePackageRedeployment,
      publicUrl,
    },
    resolvedSpaceName: spaceName,
    resolvedDeploymentId: deploymentId,
    taskIdForLogs: deployment.TaskId,
    urlInfo: {
      originalUrl: url,
      extractedSpaceId: urlParts.spaceId,
      extractedDeploymentId: deploymentId,
      resourceType: urlParts.resourceType,
    },
    nextSteps: {
      description: "To view task logs and execution details for this deployment",
      useTaskId: deployment.TaskId,
      suggestedTool: "get_task_details",
      suggestedParams: {
        spaceName,
        taskId: deployment.TaskId,
      }
    }
  };
}

export function registerGetDeploymentFromUrlTool(server: McpServer) {
  server.tool(
    'get_deployment_from_url',
    `Get deployment details from an Octopus Deploy deployment URL. Returns comprehensive deployment information including the task ID needed to view execution logs.

Accepts deployment URLs like:
https://your-octopus.com/app#/Spaces-1/projects/my-app/deployments/releases/1.0.0/deployments/Deployments-123

Returns:
- Full deployment details (environment, release, project, created time)
- taskIdForLogs: Use this with get_task_details to view execution logs
- Public URL for web portal access

Recommended workflow for investigating deployment issues:
1. Call get_deployment_from_url with the deployment URL
2. Review deployment context (environment, release version, etc.)
3. Use the returned taskIdForLogs with get_task_details to view execution logs and diagnose issues

Handles space ID to space name resolution automatically.`,
    {
      url: z.string()
        .describe("Full Octopus Deploy deployment URL (e.g., https://your-octopus.com/app#/Spaces-1/projects/my-app/deployments/releases/1.0.0/deployments/Deployments-123)")
    },
    {
      title: 'Get deployment details from an Octopus Deploy URL',
      readOnlyHint: true,
    },
    async (args) => {
      const { url } = args as GetDeploymentFromUrlParams;

      if (!url) {
        throw new Error("URL is required");
      }

      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);

      const result = await getDeploymentFromUrl(client, { url });

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
  toolName: "get_deployment_from_url",
  config: { toolset: "deployments", readOnly: true },
  registerFn: registerGetDeploymentFromUrlTool,
});
