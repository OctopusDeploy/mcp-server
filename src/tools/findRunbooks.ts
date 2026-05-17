import {
  Client,
  ProjectRepository,
  RunbookRepository,
  resolveSpaceId,
  type Project,
  type ResourceCollection,
  type Runbook,
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";
import { hasRunbooksInGit } from "../helpers/vcsProjectHelpers.js";
import { zodErrorResponse } from "../helpers/zodErrorResponse.js";

function runbookSummary(
  runbook: Runbook,
  spaceName: string,
  cac?: { project: Project; gitRef: string },
) {
  const encodedSpace = encodeURIComponent(spaceName);

  if (cac) {
    const runbookSlug = runbookSlugOf(runbook);
    const projectSlug = cac.project.Slug;
    const resourceUri =
      runbookSlug && projectSlug
        ? `octopus://spaces/${encodedSpace}/projects/${encodeURIComponent(
            projectSlug,
          )}/${encodeURIComponent(cac.gitRef)}/runbooks/${encodeURIComponent(
            runbookSlug,
          )}`
        : undefined;

    return {
      id: runbook.Id,
      name: runbook.Name,
      description: runbook.Description,
      projectId: runbook.ProjectId,
      runbookProcessId: runbook.RunbookProcessId,
      gitRef: cac.gitRef,
      multiTenancyMode: runbook.MultiTenancyMode,
      environmentScope: runbook.EnvironmentScope,
      environments: runbook.Environments,
      ...(resourceUri ? { resourceUri } : {}),
    };
  }

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
    resourceUri: `octopus://spaces/${encodedSpace}/runbooks/${encodeURIComponent(runbook.Id)}`,
  };
}

// CaC runbooks are addressed by slug. The api-client's Runbook type doesn't
// declare a Slug field, but the wire response carries one for git-stored
// runbooks. Fall back to undefined (caller omits resourceUri) rather than
// fabricating an unfetchable URI.
function runbookSlugOf(runbook: Runbook): string | undefined {
  const slug = (runbook as unknown as { Slug?: unknown }).Slug;
  return typeof slug === "string" && slug.length > 0 ? slug : undefined;
}

function defaultBranchOf(project: Project): string | undefined {
  if (project.PersistenceSettings.Type === "VersionControlled") {
    return project.PersistenceSettings.DefaultBranch;
  }
  return undefined;
}

// SDK workaround: publish a plain `z.object(...)` as `inputSchema`; refinements
// live on `findRunbooksValidationSchema` and run inside the handler. See the
// comment on run_runbook / find_events for the underlying reason.
const findRunbooksRawShape = {
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
      "Fetch a single DB-backed runbook by ID (e.g. 'Runbooks-123'). Mutually exclusive with partialName/skip/take and with gitRef/runbookSlug.",
    ),
  runbookSlug: z
    .string()
    .optional()
    .describe(
      "Config-as-Code only. Fetch a single CaC runbook by slug at the given gitRef. Requires gitRef.",
    ),
  gitRef: z
    .string()
    .optional()
    .describe(
      "For Config-as-Code projects only. A branch name (e.g. 'main'), tag, or commit SHA. Use get_branches to list available branches.",
    ),
  partialName: z
    .string()
    .optional()
    .describe("Filter listing by partial runbook name (case-insensitive)."),
  skip: z.number().optional().describe("Pagination offset."),
  take: z.number().optional().describe("Pagination page size."),
};

export const findRunbooksInputSchema = z.object(findRunbooksRawShape);

export const findRunbooksValidationSchema = findRunbooksInputSchema.superRefine(
  (args, ctx) => {
    if (args.runbookId && args.partialName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "partialName cannot be combined with runbookId. Use runbookId to fetch a single runbook; use partialName to filter the listing.",
        path: ["partialName"],
      });
    }
    if (args.runbookId && args.gitRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "gitRef cannot be combined with runbookId. CaC runbooks have no 'Runbooks-N' ID; use runbookSlug with gitRef instead.",
        path: ["gitRef"],
      });
    }
    if (args.runbookId && args.runbookSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "runbookSlug and runbookId are mutually exclusive. runbookSlug is for CaC runbooks; runbookId is for DB-backed runbooks.",
        path: ["runbookSlug"],
      });
    }
    if (args.runbookSlug && !args.gitRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "runbookSlug requires gitRef. CaC runbooks are version-pinned by gitRef (branch, tag, or commit).",
        path: ["runbookSlug"],
      });
    }
  },
);

export type FindRunbooksParams = z.infer<typeof findRunbooksValidationSchema>;

export async function findRunbooksHandler(params: FindRunbooksParams) {
  const {
    spaceName,
    projectName,
    runbookId,
    runbookSlug,
    gitRef,
    partialName,
    skip,
    take,
  } = params;

  try {
    const client = await Client.create(getClientConfigurationFromEnvironment());
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
                  `Use list_projects to find valid project names. Project names are case-sensitive.`,
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
                  ` Use get_branches to list branches.`,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    if (!runbooksInGit && (gitRef || runbookSlug)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: false,
                error:
                  `Project '${projectName}' stores its runbooks in the database; ` +
                  `gitRef/runbookSlug are not applicable. Use runbookId for a single fetch, or omit it to list.`,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    if (runbooksInGit && gitRef) {
      const runbookRepository = new RunbookRepository(
        client,
        spaceName,
        project,
      );

      const lookupKey = runbookSlug ?? runbookId;
      if (lookupKey) {
        const runbook = await runbookRepository.getWithGitRef(
          lookupKey,
          gitRef,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                runbookSummary(runbook, spaceName, { project, gitRef }),
              ),
            },
          ],
        };
      }

      const spaceId = await resolveSpaceId(client, spaceName);
      const listing = await client.get<ResourceCollection<Runbook>>(
        "~/api/{spaceId}/projects/{projectId}/{gitRef}/runbooks{?skip,take,partialName}",
        {
          spaceId,
          projectId: project.Id,
          gitRef,
          ...(skip !== undefined ? { skip } : {}),
          ...(take !== undefined ? { take } : {}),
          ...(partialName ? { partialName } : {}),
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              totalResults: listing.TotalResults,
              itemsPerPage: listing.ItemsPerPage,
              numberOfPages: listing.NumberOfPages,
              lastPageNumber: listing.LastPageNumber,
              items: listing.Items.map((runbook) =>
                runbookSummary(runbook, spaceName, { project, gitRef }),
              ),
            }),
          },
        ],
      };
    }

    const runbookRepository = new RunbookRepository(client, spaceName, project);

    if (runbookId) {
      const runbook = await runbookRepository.get(runbookId);
      return {
        content: [
          {
            type: "text" as const,
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
          type: "text" as const,
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
      entityId: runbookId ?? runbookSlug,
      spaceName,
      helpText:
        "Use list_projects to find valid project names. Call find_runbooks without runbookId/runbookSlug to list runbooks. " +
        "For Config-as-Code projects, pass gitRef (use get_branches to list refs).",
    });
  }
}

export function registerFindRunbooksTool(server: McpServer) {
  server.registerTool(
    "find_runbooks",
    {
      title: "Find runbooks in a project",
      description: `Find runbooks in an Octopus Deploy project.

Two project kinds are supported:
- DB-backed projects: address runbooks by 'runbookId' (e.g. 'Runbooks-123'). The summary includes 'publishedRunbookSnapshotId', which run_runbook uses by default.
- Config-as-Code (CaC) projects: pass 'gitRef' (branch name like 'main', tag, or commit SHA). Address a single runbook by 'runbookSlug'. The summary includes 'gitRef' instead of 'publishedRunbookSnapshotId'; run_runbook needs the same gitRef.

Modes:
- runbookId             → fetch a single DB runbook.
- runbookSlug + gitRef  → fetch a single CaC runbook.
- gitRef alone          → list CaC runbooks at that ref.
- neither               → list DB runbooks in the project (optionally filtered by partialName).

Each summary includes multiTenancyMode and environmentScope so callers can determine which environments and tenants are valid targets before invoking run_runbook.`,
      inputSchema: findRunbooksInputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const parsed = findRunbooksValidationSchema.safeParse(args);
      if (!parsed.success) return zodErrorResponse(parsed.error);
      return findRunbooksHandler(parsed.data);
    },
  );
}

registerToolDefinition({
  toolName: "find_runbooks",
  config: { toolset: "runbooks", readOnly: true },
  registerFn: registerFindRunbooksTool,
});
