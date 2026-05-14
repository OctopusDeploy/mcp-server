import {
  Client,
  ProjectRepository,
  RunbookRunRepository,
  type Project,
} from "@octopusdeploy/api-client";
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
import { hasRunbooksInGit } from "../helpers/vcsProjectHelpers.js";

export const runRunbookSchema = z
  .object({
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
        "DB-backed runbooks only. Specific snapshot ID. Defaults to the runbook's published snapshot if omitted. Not applicable to Config-as-Code runbooks.",
      ),
    gitRef: z
      .string()
      .optional()
      .describe(
        "Config-as-Code runbooks only. A branch name (e.g. 'main'), tag, or commit SHA. Use get_branches to list available refs. Mutually exclusive with runbookSnapshotId.",
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
  })
  .superRefine((args, ctx) => {
    if (args.gitRef && args.runbookSnapshotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "runbookSnapshotId cannot be combined with gitRef. Config-as-Code runbooks are version-pinned by gitRef; DB-backed runbooks by snapshot. Use one or the other.",
        path: ["runbookSnapshotId"],
      });
    }
  });

export type RunRunbookParams = z.infer<typeof runRunbookSchema>;

function defaultBranchOf(project: Project): string | undefined {
  if (project.PersistenceSettings.Type === "VersionControlled") {
    return project.PersistenceSettings.DefaultBranch;
  }
  return undefined;
}

export async function runRunbookHandler(
  server: McpServer,
  params: RunRunbookParams,
) {
  const {
    spaceName,
    projectName,
    runbookName,
    environmentNames,
    tenants,
    tenantTags,
    runbookSnapshotId,
    gitRef,
    promptedVariableValues,
    useGuidedFailure,
    forcePackageDownload,
    specificMachineNames,
    excludedMachineNames,
    skipStepNames,
    runAt,
    noRunAfter,
    confirm,
  } = params;

  try {
    const configuration = getClientConfigurationFromEnvironment();
    const client = await Client.create(configuration);

    const projectRepository = new ProjectRepository(client, spaceName);
    const projectMatches = await projectRepository.list({
      partialName: projectName,
      take: 100,
    });
    const project = projectMatches.Items.find((p) => p.Name === projectName);
    if (!project) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: false,
                error:
                  `Project '${projectName}' not found in space '${spaceName}'. ` +
                  `Use list_projects to find valid project names.`,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const runbooksInGit = hasRunbooksInGit(project.PersistenceSettings);

    if (runbooksInGit && !gitRef) {
      const defaultBranch = defaultBranchOf(project);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: false,
                error:
                  `Project '${projectName}' stores its runbooks in Git. ` +
                  `Pass gitRef (branch name, tag, or commit SHA).` +
                  (defaultBranch
                    ? ` Project default branch: '${defaultBranch}'.`
                    : "") +
                  ` Use get_branches to list refs.`,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    if (!runbooksInGit && gitRef) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: false,
                error:
                  `Project '${projectName}' stores its runbooks in the database; ` +
                  `gitRef is not applicable. Omit gitRef, or use runbookSnapshotId to pick a specific snapshot.`,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const isTenanted =
      (tenants && tenants.length > 0) ||
      (tenantTags && tenantTags.length > 0);

    const tenantSummary = isTenanted
      ? ` for tenants [${(tenants ?? []).join(", ")}${
          tenantTags?.length ? `; tags: ${tenantTags.join(", ")}` : ""
        }]`
      : "";
    const gitRefSuffix = runbooksInGit ? ` (gitRef: ${gitRef})` : "";
    const confirmMessage =
      `Run runbook ${runbookName} of ${projectName} in ` +
      `[${environmentNames.join(", ")}]${tenantSummary} in space ${spaceName}${gitRefSuffix}?`;

    const baseCommand = {
      spaceName: spaceName,
      ProjectName: projectName,
      RunbookName: runbookName,
      EnvironmentNames: environmentNames,
      ...(tenants && { Tenants: tenants }),
      ...(tenantTags && { TenantTags: tenantTags }),
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

    // DB command may also carry Snapshot. Zod has already rejected
    // Snapshot+gitRef, so this branch only ever fires for DB runbooks.
    const dbCommand = {
      ...baseCommand,
      ...(runbookSnapshotId && { Snapshot: runbookSnapshotId }),
    };

    const commandForConfirm = runbooksInGit ? baseCommand : dbCommand;

    const confirmation = await requireConfirmation(server, {
      message: confirmMessage,
      fallbackConfirm: confirm,
      change: { source: {}, target: commandForConfirm },
    });
    if (!confirmation.confirmed) {
      return unconfirmedResponse(confirmation, { action: "runbook run" });
    }

    const runbookRunRepository = new RunbookRunRepository(client, spaceName);

    const response =
      runbooksInGit && gitRef
        ? await runbookRunRepository.createGit(baseCommand, gitRef)
        : await runbookRunRepository.create(dbCommand);

    const tasks = response.RunbookRunServerTasks || [];
    const encodedSpace = encodeURIComponent(spaceName);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              runsCreated: tasks.length,
              ...(runbooksInGit ? { gitRef } : {}),
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
            type: "text" as const,
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
        "Use list_projects to find valid project names, list_environments for environment names, find_tenants for tenant information. " +
        "For DB runbooks ensure the runbook has a published snapshot (or pass runbookSnapshotId); for Config-as-Code runbooks pass gitRef (use get_branches).",
    });
  }
}

export function registerRunRunbookTool(server: McpServer) {
  server.registerTool(
    "run_runbook",
    {
      title: "Run a runbook in Octopus Deploy",
      description: `Run a runbook against one or more environments in Octopus Deploy.

Runbooks execute operational processes (DB backups, smoke tests, environment refresh, etc.) against the specified environments. For tenanted runs, supply tenants and/or tenantTags.

Two project kinds:
- DB-backed projects: by default the runbook's published snapshot is used; pass runbookSnapshotId to pick a specific snapshot.
- Config-as-Code projects: pass gitRef (branch name like 'main', tag, or commit SHA). Snapshots don't apply — the gitRef is the version pin. Use find_runbooks with the same gitRef to discover runbook names.`,
      inputSchema: runRunbookSchema,
      annotations: DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS,
    },
    (params) => runRunbookHandler(server, params),
  );
}

registerToolDefinition({
  toolName: "run_runbook",
  config: { toolset: "runbooks", readOnly: false },
  registerFn: registerRunRunbookTool,
  // The api-client's RunbookRunRepository.create/createGit throw at runtime if
  // the server is older than 2022.3.5512 (the Executions API minimum). Surface
  // that here so --list-tools-by-version reports it accurately.
  minimumOctopusVersion: "2022.3.5512",
});
