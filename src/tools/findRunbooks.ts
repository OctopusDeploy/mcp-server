import {
  Client,
  ProjectRepository,
  RunbookRepository,
  type Runbook,
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";

function runbookSummary(runbook: Runbook, spaceName: string) {
  const encodedSpace = encodeURIComponent(spaceName);
  const encodedId = encodeURIComponent(runbook.Id);

  return {
    id: runbook.Id,
    name: runbook.Name,
    description: runbook.Description,
    projectId: runbook.ProjectId,
    runbookProcessId: runbook.RunbookProcessId,
    publishedRunbookSnapshotId: runbook.PublishedRunbookSnapshotId,
    multiTenancyMode: runbook.MultiTenancyMode,
    environmentScope: runbook.EnvironmentScope,
    environments: runbook.Environments,
    resourceUri: `octopus://spaces/${encodedSpace}/runbooks/${encodedId}`,
  };
}

const findRunbooksSchema = z
  .object({
    spaceName: z.string().describe("Space name."),
    projectName: z
      .string()
      .describe(
        "Project name. Runbooks are scoped to a project, so this is required for both single fetch and listing.",
      ),
    runbookId: z
      .string()
      .optional()
      .describe(
        "Fetch a single runbook by ID. Mutually exclusive with partialName/skip/take.",
      ),
    partialName: z
      .string()
      .optional()
      .describe("Filter listing by partial runbook name (case-insensitive)."),
    skip: z.number().optional().describe("Pagination offset."),
    take: z.number().optional().describe("Pagination page size."),
  })
  .superRefine((args, ctx) => {
    if (args.runbookId && args.partialName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "partialName cannot be combined with runbookId. Use runbookId to fetch a single runbook; use partialName to filter the listing.",
        path: ["partialName"],
      });
    }
  });

export function registerFindRunbooksTool(server: McpServer) {
  server.registerTool(
    "find_runbooks",
    {
      title: "Find runbooks in a project",
      description: `Find runbooks in an Octopus Deploy project.

Two modes, picked by which arguments are supplied:
- runbookId  → fetch the summary for that runbook.
- neither    → list all runbooks in the project (optionally filtered by partialName).

Each summary includes the publishedRunbookSnapshotId (which run_runbook uses by default), the multiTenancyMode, and the environmentScope so callers can determine which environments and tenants are valid targets before invoking run_runbook.`,
      inputSchema: findRunbooksSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ spaceName, projectName, runbookId, partialName, skip, take }) => {
      try {
        const client = await Client.create(
          getClientConfigurationFromEnvironment(),
        );
        const projectRepository = new ProjectRepository(client, spaceName);

        const projectMatches = await projectRepository.list({
          partialName: projectName,
          take: 100,
        });
        const project = projectMatches.Items.find(
          (p) => p.Name === projectName,
        );
        if (!project) {
          throw new Error(
            `Project '${projectName}' not found in space '${spaceName}'. ` +
              `Use list_projects to find valid project names. Project names are case-sensitive.`,
          );
        }

        const runbookRepository = new RunbookRepository(
          client,
          spaceName,
          project,
        );

        if (runbookId) {
          const runbook = await runbookRepository.get(runbookId);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(runbookSummary(runbook, spaceName)),
              },
            ],
          };
        }

        const runbooksResponse = await runbookRepository.list({
          partialName,
          skip,
          take,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                totalResults: runbooksResponse.TotalResults,
                itemsPerPage: runbooksResponse.ItemsPerPage,
                numberOfPages: runbooksResponse.NumberOfPages,
                lastPageNumber: runbooksResponse.LastPageNumber,
                items: runbooksResponse.Items.map((runbook) =>
                  runbookSummary(runbook, spaceName),
                ),
              }),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, {
          entityType: "runbook",
          entityId: runbookId,
          spaceName,
          helpText:
            "Use list_projects to find valid project names. Call find_runbooks without runbookId to list all runbooks for a project.",
        });
      }
    },
  );
}

registerToolDefinition({
  toolName: "find_runbooks",
  config: { toolset: "runbooks", readOnly: true },
  registerFn: registerFindRunbooksTool,
});
