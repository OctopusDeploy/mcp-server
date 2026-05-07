import { Client, RunbookRunRepository } from "@octopusdeploy/api-client";
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

export function registerRunRunbookTool(server: McpServer) {
  server.registerTool(
    "run_runbook",
    {
      title: "Run a runbook in Octopus Deploy",
      description: `Run a runbook against one or more environments in Octopus Deploy

Runbooks execute operational processes (DB backups, smoke tests, environment refresh, etc.) against the specified environments. By default the published snapshot is used; pass runbookSnapshotId to run a specific snapshot. For tenanted runs, supply tenants and/or tenantTags.`,
      inputSchema: {
        spaceName: z.string().describe("The space name"),
        projectName: z.string().describe("The project name"),
        runbookName: z
          .string()
          .describe("The runbook name (within the project)"),
        environmentNames: z
          .array(z.string())
          .min(1)
          .describe(
            "Array of environment names. At least one environment must be provided.",
          ),
        tenants: z
          .array(z.string())
          .optional()
          .describe("Array of tenant names for tenanted runs (optional)"),
        tenantTags: z
          .array(z.string())
          .optional()
          .describe(
            "Array of tenant tags for tenanted runs (e.g., ['Region/US-West', 'Tier/Production'])",
          ),
        runbookSnapshotId: z
          .string()
          .optional()
          .describe(
            "Specific snapshot ID. Defaults to the runbook's published snapshot if omitted.",
          ),
        promptedVariableValues: z
          .record(z.string())
          .optional()
          .describe("Prompted variable values as key-value pairs"),
        useGuidedFailure: z
          .boolean()
          .optional()
          .describe("Use guided failure mode"),
        forcePackageDownload: z
          .boolean()
          .optional()
          .describe("Force package download"),
        specificMachineNames: z
          .array(z.string())
          .optional()
          .describe("Run on specific machines only"),
        excludedMachineNames: z
          .array(z.string())
          .optional()
          .describe("Exclude specific machines from the run"),
        skipStepNames: z
          .array(z.string())
          .optional()
          .describe("Skip specific runbook steps"),
        runAt: z
          .string()
          .optional()
          .describe("Schedule run for later (ISO 8601 date string)"),
        noRunAfter: z
          .string()
          .optional()
          .describe("Don't run after this time (ISO 8601 date string)"),
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Required only when the MCP client does not support elicitation. Set to true to confirm the run; otherwise the tool aborts.",
          ),
      },
      annotations: DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS,
    },
    async ({
      spaceName,
      projectName,
      runbookName,
      environmentNames,
      tenants,
      tenantTags,
      runbookSnapshotId,
      promptedVariableValues,
      useGuidedFailure,
      forcePackageDownload,
      specificMachineNames,
      excludedMachineNames,
      skipStepNames,
      runAt,
      noRunAfter,
      confirm,
    }) => {
      try {
        const isTenanted =
          (tenants && tenants.length > 0) ||
          (tenantTags && tenantTags.length > 0);

        const tenantSummary = isTenanted
          ? ` for tenants [${(tenants ?? []).join(", ")}${
              tenantTags?.length ? `; tags: ${tenantTags.join(", ")}` : ""
            }]`
          : "";
        const confirmMessage =
          `Run runbook ${runbookName} of ${projectName} in ` +
          `[${environmentNames.join(", ")}]${tenantSummary} in space ${spaceName}?`;

        const command = {
          spaceName: spaceName,
          ProjectName: projectName,
          RunbookName: runbookName,
          EnvironmentNames: environmentNames,
          ...(tenants && { Tenants: tenants }),
          ...(tenantTags && { TenantTags: tenantTags }),
          ...(runbookSnapshotId && { Snapshot: runbookSnapshotId }),
          ...(promptedVariableValues && { Variables: promptedVariableValues }),
          ...(useGuidedFailure !== undefined && {
            UseGuidedFailure: useGuidedFailure,
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
          ...(runAt && { RunAt: new Date(runAt) }),
          ...(noRunAfter && { NoRunAfter: new Date(noRunAfter) }),
        };

        const confirmation = await requireConfirmation(server, {
          message: confirmMessage,
          fallbackConfirm: confirm,
          change: { source: {}, target: command },
        });
        if (!confirmation.confirmed) {
          return unconfirmedResponse(confirmation, { action: "runbook run" });
        }

        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const runbookRunRepository = new RunbookRunRepository(
          client,
          spaceName,
        );

        const response = await runbookRunRepository.create(command);

        const tasks = response.RunbookRunServerTasks || [];
        const encodedSpace = encodeURIComponent(spaceName);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  runsCreated: tasks.length,
                  runbookRunTasks: tasks.map((task) => ({
                    taskId: task.ServerTaskId,
                    runbookRunId: task.RunbookRunId,
                    resourceUri: `octopus://spaces/${encodedSpace}/tasks/${encodeURIComponent(task.ServerTaskId)}`,
                  })),
                  message: `Successfully started ${tasks.length} runbook run(s) for ${runbookName}`,
                  helpText: `Fetch octopus://spaces/{spaceName}/tasks/{taskId} (or /details for the structured activity tree) via resources/read or read_resource to monitor run progress. To search the raw log for a specific error or step, call grep_task_log with the taskId.`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
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

        handleOctopusApiError(error, {
          entityType: "runbook run",
          spaceName,
          helpText:
            "Use list_projects to find valid project names, list_environments for environment names, find_tenants for tenant information. Ensure the runbook has a published snapshot (or pass an explicit runbookSnapshotId) and you have permissions to run it.",
        });
      }
    },
  );
}

registerToolDefinition({
  toolName: "run_runbook",
  config: { toolset: "runbooks", readOnly: false },
  registerFn: registerRunRunbookTool,
});
