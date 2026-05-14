import {
  Client,
  resolveSpaceId,
  type ResourceCollection,
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { stripLinks } from "../helpers/stripLinks.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";

/**
 * Shape of an Octopus audit event (also called an Event resource).
 *
 * The @octopusdeploy/api-client SDK does not expose an EventRepository or
 * EventResource type, so we declare the fields we care about locally. Fields
 * mirror Octopus.Core/Resources/EventResource.cs; unrecognised fields pass
 * through the JSON serialisation untouched.
 */
interface EventReference {
  ReferencedDocumentId: string;
  IndexPositionInRelatedDocumentIds: number;
  StartIndexInMessage: number;
  LengthInMessage: number;
}

interface ChangeDetails {
  DocumentContext: string | null;
  Differences: string | null;
  DocumentVersion: string | null;
}

interface EventResource {
  Id: string;
  RelatedDocumentIds: string[];
  Category: string;
  UserId: string;
  Username: string;
  IsService: boolean;
  IdentityEstablishedWith: string;
  UserAgent: string;
  Occurred: string;
  Message: string;
  MessageHtml: string;
  MessageReferences: EventReference[];
  Comments: string | null;
  Details: string | null;
  ChangeDetails?: ChangeDetails | null;
  IpAddress: string | null;
  SpaceId: string | null;
}

interface EventCategoryResource {
  Id: string;
  Name: string;
  Description?: string | null;
}

interface EventGroupResource {
  Id: string;
  Name: string;
  EventCategories?: string[];
}

interface DocumentTypeResource {
  Id: string;
  Name: string;
  Description?: string | null;
}

type EventMode =
  | "search"
  | "listCategories"
  | "listGroups"
  | "listAgents"
  | "listDocumentTypes";

const SEARCH_ONLY_FIELDS = [
  "spaceName",
  "eventId",
  "regarding",
  "regardingAny",
  "users",
  "projects",
  "environments",
  "tenants",
  "projectGroups",
  "eventCategories",
  "eventGroups",
  "eventAgents",
  "documentTypes",
  "tags",
  "from",
  "to",
  "includeInternalEvents",
  "excludeDifference",
  "skip",
  "take",
] as const;

const SINGLE_EVENT_CONFLICTS = [
  "regarding",
  "regardingAny",
  "users",
  "projects",
  "environments",
  "tenants",
  "projectGroups",
  "eventCategories",
  "eventGroups",
  "eventAgents",
  "documentTypes",
  "tags",
  "from",
  "to",
  "skip",
  "take",
] as const;

const findEventsSchema = z
  .object({
    mode: z
      .enum([
        "search",
        "listCategories",
        "listGroups",
        "listAgents",
        "listDocumentTypes",
      ])
      .optional()
      .describe(
        "What to return. Defaults to 'search' (the audit log itself). " +
          "Metadata modes enumerate valid filter values: listCategories returns every event category " +
          "(e.g. DeploymentSucceeded, ReleaseCreated); listGroups returns category groupings " +
          "(Created/Modified/Deleted/Deployment/Interruption/...); listAgents returns the user-agent strings " +
          "seen by the audit subsystem; listDocumentTypes returns entity-prefix metadata (Projects-, Releases-, ...). " +
          "Use a metadata mode first when you need to construct an eventCategories/eventGroups/documentTypes filter " +
          "and don't know the valid values. Metadata modes ignore every other argument.",
      ),
    spaceName: z
      .string()
      .optional()
      .describe(
        "Space name. Required for mode='search'. Ignored by metadata modes (they are server-wide).",
      ),
    eventId: z
      .string()
      .optional()
      .describe(
        "Fetch a single event by ID (form 'Events-NNN'). Mutually exclusive with all filter arguments.",
      ),
    regarding: z
      .array(z.string())
      .optional()
      .describe(
        "Document IDs the event must relate to. AND semantics: event must reference EVERY id listed. " +
          "Use regardingAny for OR semantics.",
      ),
    regardingAny: z
      .array(z.string())
      .optional()
      .describe(
        "Document IDs the event may relate to. OR semantics: event references ANY id listed.",
      ),
    users: z
      .array(z.string())
      .optional()
      .describe("User IDs who triggered the event (OR semantics within the list)."),
    projects: z
      .array(z.string())
      .optional()
      .describe("Project IDs the event relates to (OR semantics)."),
    environments: z
      .array(z.string())
      .optional()
      .describe("Environment IDs the event relates to (OR semantics)."),
    tenants: z
      .array(z.string())
      .optional()
      .describe("Tenant IDs the event relates to (OR semantics)."),
    projectGroups: z
      .array(z.string())
      .optional()
      .describe(
        "Project group IDs. Events for any project inside these groups are included.",
      ),
    eventCategories: z
      .array(z.string())
      .optional()
      .describe(
        "Event category names, e.g. ['DeploymentSucceeded','DeploymentFailed']. " +
          "Use mode='listCategories' to discover the full set.",
      ),
    eventGroups: z
      .array(z.string())
      .optional()
      .describe(
        "Event group names, e.g. ['Created','Modified','Deleted','Deployment','Interruption']. " +
          "Each group is expanded server-side to the categories it contains. " +
          "Use mode='listGroups' to discover the full set.",
      ),
    eventAgents: z
      .array(z.string())
      .optional()
      .describe(
        "User-agent strings of the clients that triggered the events. " +
          "Use mode='listAgents' to discover the values present in this instance.",
      ),
    documentTypes: z
      .array(z.string())
      .optional()
      .describe(
        "Document type prefixes, e.g. ['Projects-','Releases-']. " +
          "Use mode='listDocumentTypes' to discover the full set.",
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        "Canonical tenant tag IDs of the form 'TagSetName/TagName'. " +
          "Filters events whose related tenants carry these tags.",
      ),
    from: z
      .string()
      .optional()
      .describe(
        "ISO 8601 datetime. Inclusive lower bound on Occurred (Occurred >= from).",
      ),
    to: z
      .string()
      .optional()
      .describe(
        "ISO 8601 datetime. Exclusive upper bound on Occurred (Occurred < to).",
      ),
    includeInternalEvents: z
      .boolean()
      .optional()
      .describe(
        "Default true. Set false to suppress per-target MachineAdded / MachineDeleted / " +
          "MachineDeploymentRelatedPropertyWasUpdated noise that floods machine-heavy instances.",
      ),
    excludeDifference: z
      .boolean()
      .optional()
      .describe(
        "Set true to omit the ChangeDetails field (the before/after diff). " +
          "ChangeDetails is by far the heaviest field per event — recommended for any scan of more than a few events.",
      ),
    skip: z
      .number()
      .optional()
      .describe("Pagination offset (search mode only)."),
    take: z
      .number()
      .optional()
      .describe(
        "Pagination page size (search mode only). Server default is 30.",
      ),
  })
  .superRefine((args, ctx) => {
    const mode: EventMode = args.mode ?? "search";

    if (mode === "search") {
      if (!args.spaceName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "spaceName is required when mode='search'.",
          path: ["spaceName"],
        });
      }
      if (args.eventId) {
        for (const key of SINGLE_EVENT_CONFLICTS) {
          if ((args as Record<string, unknown>)[key] !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${key} cannot be combined with eventId. Drop eventId to use list filters, or drop ${key} to fetch a single event.`,
              path: [key],
            });
          }
        }
      }
      return;
    }

    // Metadata modes: spaceName is allowed (harmless), every search filter is rejected.
    for (const key of SEARCH_ONLY_FIELDS) {
      if (key === "spaceName") continue;
      if ((args as Record<string, unknown>)[key] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is only valid when mode='search'. Drop it to call mode='${mode}'.`,
          path: [key],
        });
      }
    }
  });

function eventSummary(event: EventResource, excludeDifference?: boolean) {
  const stripped = stripLinks(event) as Record<string, unknown>;
  if (excludeDifference) {
    delete stripped.ChangeDetails;
  }
  return stripped;
}

export function registerFindEventsTool(server: McpServer) {
  server.registerTool(
    "find_events",
    {
      title: "Search the Octopus audit log",
      description: `Search the Octopus Deploy audit log (also called the Events log) — every meaningful action recorded against a space: deployments, release creations, modifications, user logins, machine registrations, variable edits, tenant changes, and so on.

**Modes** (the \`mode\` arg):
- \`search\` (default) — query the audit log. Requires \`spaceName\`. Supports rich filtering by user, project, environment, tenant, document type, date range, category, group, and agent.
- \`listCategories\` — enumerate every event category (e.g. \`DeploymentSucceeded\`).
- \`listGroups\` — enumerate event groups (e.g. \`Created\`, \`Modified\`, \`Deleted\`, \`Deployment\`). Each group lists the categories inside it.
- \`listAgents\` — enumerate user-agent strings recorded by the audit subsystem.
- \`listDocumentTypes\` — enumerate entity-prefix metadata (\`Projects-\`, \`Releases-\`, ...).

**Search modes** (within \`mode='search'\`, picked by argument shape):
- \`eventId\` → fetch that single event (mutually exclusive with every filter argument).
- otherwise → list events matching the filters, paginated.

**Performance tip:** the per-event \`ChangeDetails\` field (the before/after diff for Modified events) is by far the heaviest payload field. Pass \`excludeDifference: true\` whenever scanning many events; fetch a single event without the flag when you need the diff.

**Filter semantics:**
- \`regarding\` — AND semantics: event must reference EVERY listed document ID.
- \`regardingAny\` — OR semantics: event must reference ANY listed document ID.
- All other multi-value filters (users, projects, environments, tenants, eventCategories, eventGroups, ...) are OR semantics within the field.
- \`from\` (inclusive) and \`to\` (exclusive) accept ISO 8601 datetimes.

**Permissions:** requires \`EventView\` on the calling user's space scope. The server filters results further based on per-document permissions.`,
      inputSchema: findEventsSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const mode: EventMode = args.mode ?? "search";
      const client = await Client.create(getClientConfigurationFromEnvironment());

      // --- Metadata modes (unscoped, no permission required) -------------------
      if (mode !== "search") {
        const path = (() => {
          switch (mode) {
            case "listCategories":
              return "~/api/events/categories";
            case "listGroups":
              return "~/api/events/groups";
            case "listAgents":
              return "~/api/events/agents";
            case "listDocumentTypes":
              return "~/api/events/documenttypes";
          }
        })();

        try {
          const result = await client.get<unknown>(path);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ mode, items: result }),
              },
            ],
          };
        } catch (error) {
          handleOctopusApiError(error, {
            helpText:
              "The events metadata endpoints (categories/groups/agents/documenttypes) require no permissions; an error here usually means OCTOPUS_SERVER_URL is wrong or the API key is invalid.",
          });
        }
      }

      // --- Search mode --------------------------------------------------------
      // spaceName presence is enforced by superRefine; assert for the type checker.
      const spaceName = args.spaceName as string;
      const spaceId = await resolveSpaceId(client, spaceName);

      // Single-event fast path
      if (args.eventId) {
        validateEntityId(args.eventId, "event", ENTITY_PREFIXES.event);

        try {
          const event = await client.get<EventResource>(
            "~/api/{spaceId}/events/{id}",
            { spaceId, id: args.eventId },
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(eventSummary(event, args.excludeDifference)),
              },
            ],
          };
        } catch (error) {
          handleOctopusApiError(error, {
            entityType: "event",
            entityId: args.eventId,
            spaceName,
            helpText:
              "Call find_events without eventId to list valid event IDs in this space.",
          });
        }
      }

      // List/search path
      try {
        const response = await client.get<ResourceCollection<EventResource>>(
          "~/api/{spaceId}/events{?skip,take,from,to,regarding,regardingAny,users,projects,environments,tenants,projectGroups,eventCategories,eventGroups,eventAgents,documentTypes,tags,includeInternalEvents,excludeDifference}",
          {
            spaceId,
            skip: args.skip,
            take: args.take,
            from: args.from,
            to: args.to,
            regarding: args.regarding,
            regardingAny: args.regardingAny,
            users: args.users,
            projects: args.projects,
            environments: args.environments,
            tenants: args.tenants,
            projectGroups: args.projectGroups,
            eventCategories: args.eventCategories,
            eventGroups: args.eventGroups,
            eventAgents: args.eventAgents,
            documentTypes: args.documentTypes,
            tags: args.tags,
            includeInternalEvents: args.includeInternalEvents,
            excludeDifference: args.excludeDifference,
          },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                totalResults: response.TotalResults,
                itemsPerPage: response.ItemsPerPage,
                numberOfPages: response.NumberOfPages,
                lastPageNumber: response.LastPageNumber,
                items: response.Items.map((event) =>
                  eventSummary(event, args.excludeDifference),
                ),
              }),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, {
          spaceName,
          helpText:
            "Verify the space name is correct and the API key has EventView permission for this space.",
        });
      }
    },
  );
}

// Type-only references to silence unused-import warnings for the metadata
// shape interfaces — they document the response shapes for human readers
// even though the runtime accepts `unknown` and the LLM consumes the raw JSON.
export type {
  EventResource,
  EventCategoryResource,
  EventGroupResource,
  DocumentTypeResource,
};

registerToolDefinition({
  toolName: "find_events",
  config: { toolset: "events", readOnly: true },
  registerFn: registerFindEventsTool,
});
