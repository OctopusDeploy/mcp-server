import {
  Client,
  resolveSpaceId,
  type ResourceCollection,
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getPublicUrl } from "../helpers/getPublicUrl.js";
import { getCurrentUserCached } from "../helpers/userCache.js";
import { zodErrorResponse } from "../helpers/zodErrorResponse.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";

interface InterruptionFormElement {
  Name: string;
  Control?: { Type?: string } | null;
  IsValueRequired?: boolean;
}

interface InterruptionResource {
  Id: string;
  Title: string;
  Type?: string;
  Created: string;
  IsPending: boolean;
  Form?: {
    Values?: Record<string, unknown> | null;
    Elements?: InterruptionFormElement[] | null;
  } | null;
  RelatedDocumentIds?: string[];
  ResponsibleTeamIds?: string[];
  ResponsibleUserId?: string;
  CanTakeResponsibility: boolean;
  HasResponsibility: boolean;
  IsLinkedToOtherInterruption?: boolean;
  TaskId: string;
  CorrelationId?: string;
  SpaceId: string;
}

export function interruptionSummary(
  interruption: InterruptionResource,
  spaceName: string,
  instanceURL: string,
) {
  const encodedSpace = encodeURIComponent(spaceName);
  const encodedInterruptionId = encodeURIComponent(interruption.Id);
  const encodedTaskId = encodeURIComponent(interruption.TaskId);
  const elements = interruption.Form?.Elements ?? [];

  return {
    id: interruption.Id,
    title: interruption.Title,
    type: interruption.Type,
    taskId: interruption.TaskId,
    correlationId: interruption.CorrelationId,
    isPending: interruption.IsPending,
    isLinkedToOtherInterruption: interruption.IsLinkedToOtherInterruption,
    created: interruption.Created,
    relatedDocumentIds: interruption.RelatedDocumentIds ?? [],
    responsible: {
      teamIds: interruption.ResponsibleTeamIds ?? [],
      userId: interruption.ResponsibleUserId,
      canTakeResponsibility: interruption.CanTakeResponsibility,
      hasResponsibility: interruption.HasResponsibility,
    },
    formElementNames: elements.map((element) => element.Name),
    resourceUri: `octopus://spaces/${encodedSpace}/interruptions/${encodedInterruptionId}`,
    taskResourceUri: `octopus://spaces/${encodedSpace}/tasks/${encodedTaskId}`,
    publicUrl: getPublicUrl(`${instanceURL}/app#/{spaceId}/tasks/{taskId}`, {
      spaceId: interruption.SpaceId,
      taskId: interruption.TaskId,
    }),
    publicUrlInstruction:
      "View and respond to this interruption in the Octopus Deploy web portal at the provided publicUrl. " +
      "For full form details (Markdown instructions, button options, control types) dereference the resourceUri.",
  };
}

export interface FindInterruptionsParams {
  spaceName: string;
  interruptionId?: string;
  pendingOnly?: boolean;
  assignedToMe?: boolean;
  regarding?: string;
  skip?: number;
  take?: number;
}

// SDK workaround: publish a plain `z.object(...)` as `inputSchema`; refinements
// live on `findInterruptionsValidationSchema` and run inside the handler. See
// the comment on run_runbook / find_events for the underlying reason.
const findInterruptionsRawShape = {
  spaceName: z.string().describe("Space name."),
  interruptionId: z
    .string()
    .optional()
    .describe(
      "Fetch the slim summary for a single interruption by ID (e.g. Interruptions-1). " +
        "Mutually exclusive with regarding/assignedToMe/pendingOnly. " +
        "For the full body (form definition, instructions, button options, submitted values) dereference the returned resourceUri.",
    ),
  pendingOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe("Return only unprocessed (pending) interruptions. Defaults to true. Ignored when interruptionId is set."),
  assignedToMe: z
    .boolean()
    .optional()
    .describe(
      "Limit to interruptions the authenticated user can act on (CanTakeResponsibility or HasResponsibility, " +
        "or where the user is the explicit ResponsibleUserId). When true, /users/me is resolved (cached per session). " +
        "Octopus has no responsibleUserId query parameter, so the tool pages through the server result set and " +
        "post-filters; pages are scanned up to a safety cap (filteredAs.scanComplete signals whether the entire " +
        "result set was inspected). totalResults reflects the post-filter count; the unfiltered server total is " +
        "exposed under filteredAs. Ignored when interruptionId is set.",
    ),
  regarding: z
    .string()
    .optional()
    .describe(
      "Native server-side filter to interruptions related to a specific entity ID " +
        "(e.g. ServerTasks-1234, Deployments-5678). Ignored when interruptionId is set.",
    ),
  skip: z.number().optional().describe("Pagination offset. Ignored when interruptionId is set."),
  take: z.number().optional().describe("Pagination page size. Ignored when interruptionId is set."),
};

export const findInterruptionsInputSchema = z.object(findInterruptionsRawShape);

export const findInterruptionsValidationSchema =
  findInterruptionsInputSchema.superRefine((args, ctx) => {
    if (!args.interruptionId) return;
    const conflicting: Array<keyof typeof args> = [
      "regarding",
      "assignedToMe",
      "skip",
      "take",
    ];
    for (const key of conflicting) {
      if (args[key] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Provide either interruptionId (to fetch a single interruption) or list filters " +
            `(${conflicting.join(", ")}), not both.`,
          path: [key],
        });
      }
    }
  });

export async function findInterruptionsHandler(params: FindInterruptionsParams) {
  const {
    spaceName,
    interruptionId,
    pendingOnly = true,
    assignedToMe,
    regarding,
    skip,
    take,
  } = params;

  // Cheap pre-check: validate the ID format before any network round-trip,
  // so callers get a clear error without paying for the space resolve first.
  if (interruptionId) {
    validateEntityId(interruptionId, "interruption", ENTITY_PREFIXES.interruption);
  }

  const configuration = getClientConfigurationFromEnvironment();
  const client = await Client.create(configuration);

  let spaceId: string;
  try {
    spaceId = await resolveSpaceId(client, spaceName);
  } catch (error) {
    handleOctopusApiError(error, { spaceName });
  }

  // Single-id lookup mode.
  if (interruptionId) {
    try {
      const interruption = await client.get<InterruptionResource>(
        "~/api/{spaceId}/interruptions/{interruptionId}",
        { spaceId, interruptionId },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              interruptionSummary(interruption, spaceName, configuration.instanceURL),
            ),
          },
        ],
      };
    } catch (error) {
      handleOctopusApiError(error, {
        entityType: "interruption",
        entityId: interruptionId,
        spaceName,
        helpText:
          "Call find_interruptions without interruptionId to list valid IDs.",
      });
    }
  }

  // assignedToMe: scan multiple server pages and post-filter, since Octopus
  // has no native "responsibleUserId" query param. Without paging, a first
  // server page that contains zero matches would cause us to return an empty
  // result and silently miss actionable interruptions on later pages.
  if (assignedToMe) {
    const user = await getCurrentUserCached(client);
    const currentUserId = user.Id;

    const scan = await scanAssignedInterruptions(client, spaceId, {
      pendingOnly,
      regarding,
      currentUserId,
    });

    const start = skip ?? 0;
    const end =
      take !== undefined
        ? Math.min(start + take, scan.matched.length)
        : scan.matched.length;
    const sliced = scan.matched.slice(start, end);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            // Post-filter counts: the LLM's "totalResults" is the number of
            // interruptions actually assigned to the user, not the unfiltered
            // server total. The latter is surfaced under filteredAs for
            // transparency.
            totalResults: scan.matched.length,
            itemsPerPage: sliced.length,
            numberOfPages: 1,
            lastPageNumber: 0,
            filteredAs: {
              userId: currentUserId,
              serverTotalScanned: scan.serverScanned,
              serverTotalAvailable: scan.serverTotal,
              scanComplete: scan.scanComplete,
              ...(scan.scanComplete
                ? {}
                : {
                    scanIncompleteHint:
                      "Hit the safety cap before exhausting the server result set. " +
                      "Narrow the query (e.g. set regarding to a specific task, or keep pendingOnly: true) " +
                      "to ensure complete results.",
                  }),
            },
            items: sliced.map((interruption) =>
              interruptionSummary(interruption, spaceName, configuration.instanceURL),
            ),
          }),
        },
      ],
    };
  }

  // List mode (no per-user filter): pass server pagination through directly.
  const response = await client.get<ResourceCollection<InterruptionResource>>(
    "~/api/{spaceId}/interruptions{?skip,take,pendingOnly,regarding}",
    {
      spaceId,
      skip,
      take,
      pendingOnly,
      regarding,
    },
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          totalResults: response.TotalResults,
          itemsPerPage: response.ItemsPerPage,
          numberOfPages: response.NumberOfPages,
          lastPageNumber: response.LastPageNumber,
          items: (response.Items ?? []).map((interruption) =>
            interruptionSummary(interruption, spaceName, configuration.instanceURL),
          ),
        }),
      },
    ],
  };
}

/**
 * Page through the unfiltered /interruptions result set, collecting items
 * the authenticated user can act on. Octopus has no responsibleUserId query
 * parameter, so post-filtering is the only correctness-preserving option.
 *
 * Safety cap: ASSIGNED_SCAN_MAX records inspected. Almost always hit only
 * with pendingOnly: false on busy spaces with deep history; the assigned
 * set under pendingOnly: true is virtually always small.
 */
export const ASSIGNED_SCAN_PAGE_SIZE = 100;
export const ASSIGNED_SCAN_MAX = 500;

interface AssignedScanResult {
  matched: InterruptionResource[];
  serverTotal: number;
  serverScanned: number;
  scanComplete: boolean;
}

async function scanAssignedInterruptions(
  client: Client,
  spaceId: string,
  params: { pendingOnly: boolean; regarding?: string; currentUserId: string },
): Promise<AssignedScanResult> {
  const matched: InterruptionResource[] = [];
  let serverScanned = 0;
  let serverTotal = 0;
  let scanComplete = false;

  while (serverScanned < ASSIGNED_SCAN_MAX) {
    const remaining = ASSIGNED_SCAN_MAX - serverScanned;
    const pageTake = Math.min(ASSIGNED_SCAN_PAGE_SIZE, remaining);

    const page = await client.get<ResourceCollection<InterruptionResource>>(
      "~/api/{spaceId}/interruptions{?skip,take,pendingOnly,regarding}",
      {
        spaceId,
        skip: serverScanned,
        take: pageTake,
        pendingOnly: params.pendingOnly,
        regarding: params.regarding,
      },
    );

    serverTotal = page.TotalResults;
    const items = page.Items ?? [];

    for (const interruption of items) {
      if (
        interruption.CanTakeResponsibility ||
        interruption.HasResponsibility ||
        interruption.ResponsibleUserId === params.currentUserId
      ) {
        matched.push(interruption);
      }
    }

    serverScanned += items.length;

    // Empty page (or short page) means the server has no more.
    if (items.length === 0 || items.length < pageTake || serverScanned >= serverTotal) {
      scanComplete = true;
      break;
    }
  }

  return { matched, serverTotal, serverScanned, scanComplete };
}

export function registerFindInterruptionsTool(server: McpServer) {
  server.registerTool(
    "find_interruptions",
    {
      title: "Find interruptions",
      description: `Find interruptions (manual interventions, guided failures, deployment approvals) in an Octopus Deploy space.

Interruptions are the Octopus surface equivalent to pending approvals: a deployment or runbook run pauses and waits for a human to take action. Use this tool to enumerate them or to look up a single one.

Modes (picked by which arguments you supply):
- interruptionId  → fetch the slim summary for that interruption.
- assignedToMe    → list interruptions the authenticated user can act on; resolves /users/me (cached per session).
- regarding       → list interruptions related to a specific entity (ServerTasks-…, Deployments-…). Native server-side filter.
- (none)          → list all interruptions, optionally filtered by pendingOnly (default: true) and skip/take.

Each summary includes:
- resourceUri      → octopus://spaces/{spaceName}/interruptions/{id} for the FULL body (form definition with Markdown instructions, button options, control types, and any already-submitted values). Dereference this when the user asks for details about a specific interruption.
- taskResourceUri  → octopus://spaces/{spaceName}/tasks/{taskId} for the surrounding deployment/runbook task.
- publicUrl        → Octopus portal deep link to take action.
- formElementNames → just the field names (e.g. Instructions, Notes, Result). Field values are NOT in the slim summary; fetch resourceUri for those.`,
      inputSchema: findInterruptionsInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const parsed = findInterruptionsValidationSchema.safeParse(args);
      if (!parsed.success) return zodErrorResponse(parsed.error);
      return findInterruptionsHandler(parsed.data);
    },
  );
}

registerToolDefinition({
  toolName: "find_interruptions",
  config: { toolset: "interruptions", readOnly: true },
  registerFn: registerFindInterruptionsTool,
});
