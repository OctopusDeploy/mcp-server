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

const findInterruptionsSchema = z
  .object({
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
          "Items are post-filtered, so totalResults still reflects the unfiltered server-side count. " +
          "Ignored when interruptionId is set.",
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
  })
  .superRefine((args, ctx) => {
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

  // List mode.
  let currentUserId: string | undefined;
  if (assignedToMe) {
    const user = await getCurrentUserCached(client);
    currentUserId = user.Id;
  }

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

  const items = (response.Items ?? []).filter((interruption) => {
    if (!assignedToMe) {
      return true;
    }
    return (
      interruption.CanTakeResponsibility ||
      interruption.HasResponsibility ||
      (currentUserId !== undefined &&
        interruption.ResponsibleUserId === currentUserId)
    );
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          totalResults: response.TotalResults,
          itemsPerPage: response.ItemsPerPage,
          numberOfPages: response.NumberOfPages,
          lastPageNumber: response.LastPageNumber,
          ...(currentUserId !== undefined
            ? { filteredAs: { userId: currentUserId } }
            : {}),
          items: items.map((interruption) =>
            interruptionSummary(interruption, spaceName, configuration.instanceURL),
          ),
        }),
      },
    ],
  };
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
      inputSchema: findInterruptionsSchema,
      annotations: { readOnlyHint: true },
    },
    findInterruptionsHandler,
  );
}

registerToolDefinition({
  toolName: "find_interruptions",
  config: { toolset: "interruptions", readOnly: true },
  registerFn: registerFindInterruptionsTool,
});
