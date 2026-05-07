import { Client, DeploymentRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";
import {
  requireConfirmation,
  unconfirmedResponse,
} from "../helpers/requireConfirmation.js";

export function registerDeployReleaseTool(server: McpServer) {
  server.registerTool(
    "deploy_release",
    {
      title: "Deploy a release to environments in Octopus Deploy",
      description: `Deploy a release to one or more environments in Octopus Deploy

This tool supports both tenanted and untenanted deployments:
- **Untenanted**: Don't provide tenants or tenantTags. Can deploy to multiple environments at once.
- **Tenanted**: Provide tenants or tenantTags. Can only deploy to ONE environment, but can target multiple tenants.

The tool automatically determines which deployment type to use based on the parameters provided.`,
      inputSchema: {
        spaceName: z.string().describe("The space name"),
        projectName: z.string().describe("The project name"),
        releaseVersion: z
          .string()
          .describe("The release version to deploy (e.g., '1.0.0')"),
        environmentNames: z
          .array(z.string())
          .describe(
            "Array of environment names. For tenanted deployments, must contain exactly one environment.",
          ),
        tenants: z
          .array(z.string())
          .optional()
          .describe("Array of tenant names for tenanted deployment (optional)"),
        tenantTags: z
          .array(z.string())
          .optional()
          .describe(
            "Array of tenant tags for tenanted deployment (e.g., ['Region/US-West', 'Tier/Production'])",
          ),
        forcePackageRedeployment: z
          .boolean()
          .optional()
          .describe("Force redeployment of packages"),
        updateVariableSnapshot: z
          .boolean()
          .optional()
          .describe("Update the variable snapshot"),
        forcePackageDownload: z
          .boolean()
          .optional()
          .describe("Force package download"),
        specificMachineNames: z
          .array(z.string())
          .optional()
          .describe("Deploy to specific machines only"),
        excludedMachineNames: z
          .array(z.string())
          .optional()
          .describe("Exclude specific machines from deployment"),
        skipStepNames: z
          .array(z.string())
          .optional()
          .describe("Skip specific deployment steps"),
        useGuidedFailure: z
          .boolean()
          .optional()
          .describe("Use guided failure mode"),
        runAt: z
          .string()
          .optional()
          .describe("Schedule deployment for later (ISO 8601 date string)"),
        noRunAfter: z
          .string()
          .optional()
          .describe(
            "Don't run deployment after this time (ISO 8601 date string)",
          ),
        variables: z
          .record(z.string())
          .optional()
          .describe("Prompted variable values as key-value pairs"),
        deploymentFreezeOverrideReason: z
          .string()
          .optional()
          .describe("Reason for overriding deployment freeze"),
        deploymentFreezeNames: z
          .array(z.string())
          .optional()
          .describe("Names of deployment freezes to override"),
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Required only when the MCP client does not support elicitation. Set to true to confirm deployment; otherwise the tool aborts.",
          ),
      },
      annotations: DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS,
    },
    async ({
      spaceName,
      projectName,
      releaseVersion,
      environmentNames,
      tenants,
      tenantTags,
      forcePackageRedeployment,
      updateVariableSnapshot,
      forcePackageDownload,
      specificMachineNames,
      excludedMachineNames,
      skipStepNames,
      useGuidedFailure,
      runAt,
      noRunAfter,
      variables,
      deploymentFreezeOverrideReason,
      deploymentFreezeNames,
      confirm,
    }) => {
      try {
        // Validate environment names
        if (!environmentNames || environmentNames.length === 0) {
          throw new Error("At least one environment name must be provided.");
        }

        // Determine if this is a tenanted deployment
        const isTenanted =
          (tenants && tenants.length > 0) ||
          (tenantTags && tenantTags.length > 0);

        // Validate tenanted deployment constraints
        if (isTenanted && environmentNames.length !== 1) {
          throw new Error(
            `Tenanted deployments can only target one environment at a time. You provided ${environmentNames.length} environments. ` +
              `For tenanted deployments, specify exactly one environment in environmentNames, then use tenants or tenantTags to target specific tenants.`,
          );
        }

        const tenantSummary = isTenanted
          ? ` for tenants [${(tenants ?? []).join(", ")}${
              tenantTags?.length ? `; tags: ${tenantTags.join(", ")}` : ""
            }]`
          : "";
        const confirmMessage =
          `Deploy release ${releaseVersion} of ${projectName} to ` +
          `[${environmentNames.join(", ")}]${tenantSummary} in space ${spaceName}?`;

        // Build common parameters
        const commonParams = {
          spaceName: spaceName,
          ProjectName: projectName,
          ...(forcePackageRedeployment !== undefined && {
            ForcePackageRedeployment: forcePackageRedeployment,
          }),
          ...(updateVariableSnapshot !== undefined && {
            UpdateVariableSnapshot: updateVariableSnapshot,
          }),
          ...(forcePackageDownload !== undefined && {
            ForcePackageDownload: forcePackageDownload,
          }),
          ...(specificMachineNames && {
            SpecificMachineNames: specificMachineNames,
          }),
          ...(excludedMachineNames && {
            ExcludedMachineNames: excludedMachineNames,
          }),
          ...(skipStepNames && { SkipStepNames: skipStepNames }),
          ...(useGuidedFailure !== undefined && {
            UseGuidedFailure: useGuidedFailure,
          }),
          ...(runAt && { RunAt: new Date(runAt) }),
          ...(noRunAfter && { NoRunAfter: new Date(noRunAfter) }),
          ...(variables && { Variables: variables }),
          ...(deploymentFreezeOverrideReason && {
            DeploymentFreezeOverrideReason: deploymentFreezeOverrideReason,
          }),
          ...(deploymentFreezeNames && {
            DeploymentFreezeNames: deploymentFreezeNames,
          }),
        };

        const tenantedCommand = {
          ...commonParams,
          ReleaseVersion: releaseVersion,
          EnvironmentName: environmentNames[0],
          Tenants: tenants || [],
          TenantTags: tenantTags || [],
        };
        const untenantedCommand = {
          ...commonParams,
          ReleaseVersion: releaseVersion,
          EnvironmentNames: environmentNames,
        };

        const confirmation = await requireConfirmation(server, {
          message: confirmMessage,
          fallbackConfirm: confirm,
          change: {
            source: {},
            target: isTenanted ? tenantedCommand : untenantedCommand,
          },
        });
        if (!confirmation.confirmed) {
          return unconfirmedResponse(confirmation, { action: "deployment" });
        }

        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const deploymentRepository = new DeploymentRepository(
          client,
          spaceName,
        );

        const deploymentType = isTenanted ? "tenanted" : "untenanted";
        const response = isTenanted
          ? await deploymentRepository.createTenanted(tenantedCommand)
          : await deploymentRepository.create(untenantedCommand);

        // Format the response
        const tasks = response.DeploymentServerTasks || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  deploymentType,
                  deploymentsCreated: tasks.length,
                  deploymentTasks: tasks.map((task) => ({
                    taskId: task.ServerTaskId,
                    deploymentId: task.DeploymentId,
                  })),
                  message: `Successfully created ${tasks.length} deployment(s) for release ${releaseVersion}`,
                  helpText: `Fetch octopus://spaces/{spaceName}/tasks/{taskId} (or /details for the structured activity tree) via resources/read or read_resource to monitor deployment progress. To search the raw log for a specific error or step, call grep_task_log with the taskId. Use list_deployments for high-level deployment listings.`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        // Handle validation errors from our code
        if (error instanceof Error && !error.message.includes("octopus")) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: error.message,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        // Handle Octopus API errors
        handleOctopusApiError(error, {
          entityType: "deployment",
          spaceName,
          helpText:
            "Use list_projects to find valid project names, list_environments for environment names, find_releases to verify the release exists, and find_tenants for tenant information. Ensure you have permissions to create deployments.",
        });
      }
    },
  );
}

registerToolDefinition({
  toolName: "deploy_release",
  config: { toolset: "deployments", readOnly: false },
  registerFn: registerDeployReleaseTool,
  // DeploymentRepository.create / .createTenanted use the Executions API
  // (~/api/{space}/deployments/create/v1 and /create/tenanted/v1-alpha) which
  // the api-client refuses to call against servers older than 2022.3.5512.
  minimumOctopusVersion: "2022.3.5512",
});
