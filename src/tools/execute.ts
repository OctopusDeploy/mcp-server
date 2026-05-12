import { Client } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  HTTP_METHODS,
  classifyMethod,
  type HttpMethod,
  type MethodTier,
} from "../helpers/methodTier.js";
import { isSensitive } from "../helpers/sensitivePathDenylist.js";
import { matchPath, findOwningToolset } from "../helpers/pathAllowlist.js";
import { validateExecutePath } from "../helpers/validateExecutePath.js";
import {
  requireConfirmation,
  unconfirmedResponse,
} from "../helpers/requireConfirmation.js";
import { getActiveToolsetConfig } from "../helpers/activeToolsetConfig.js";
import {
  DEFAULT_TOOLSETS,
  type Toolset,
} from "../types/toolConfig.js";

interface ExecuteParams {
  method: HttpMethod;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  asCsv?: boolean;
  confirm?: boolean;
}

interface ExecuteErrorResponse {
  success: false;
  reason:
    | "invalidPath"
    | "readOnlyMode"
    | "deletesNotAllowed"
    | "sensitivePath"
    | "pathNotAllowed";
  message: string;
  details?: unknown;
}

function errorResponse(payload: ExecuteErrorResponse) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    isError: true,
  };
}

function summariseBody(body: unknown): string {
  if (body == null) return "(no body)";
  if (typeof body === "string") {
    return body.length > 200 ? `${body.slice(0, 200)}…` : body;
  }
  try {
    const json = JSON.stringify(body);
    if (json.length <= 400) return json;
    return `${json.slice(0, 400)}… (${json.length} bytes total)`;
  } catch {
    return "(unserialisable body)";
  }
}

type AuditOutcome = "ok" | "error" | "blocked" | "cancelled";

interface AuditCall {
  method: HttpMethod;
  tier: MethodTier;
  path: string;
}

/**
 * Build a one-shot audit emitter scoped to a single execute call. Captures
 * the start time so callers only state outcome + reason — no need to repeat
 * method/tier/path/durationMs at every gate. Stub on stderr; replace with the
 * structured emitter from AIF-357 once it lands.
 */
function startAudit(call: AuditCall): (
  outcome: AuditOutcome,
  reason?: string,
) => void {
  const startedAt = Date.now();
  return (outcome, reason) => {
    process.stderr.write(
      JSON.stringify({
        ts: new Date().toISOString(),
        tool: "execute",
        ...call,
        outcome,
        ...(reason !== undefined ? { reason } : {}),
        durationMs: Date.now() - startedAt,
      }) + "\n",
    );
  };
}

function resolveEnabledToolsets(): readonly Toolset[] {
  const config = getActiveToolsetConfig();
  if (config.enabledToolsets === "all" || config.enabledToolsets == null) {
    return DEFAULT_TOOLSETS;
  }
  return config.enabledToolsets;
}

interface DispatchableClient {
  resolveUrl: (path: string, args?: unknown) => string;
  dispatchRequest: (
    method: string,
    url: string,
    body?: unknown,
  ) => Promise<unknown>;
}

async function dispatchExecute(
  client: Client,
  method: HttpMethod,
  path: string,
  query: Record<string, string> | undefined,
  body: unknown,
): Promise<unknown> {
  const dispatchable = client as unknown as DispatchableClient;
  const url = dispatchable.resolveUrl(path, query);
  return dispatchable.dispatchRequest(method, url, body ?? null);
}

const inputSchema = {
  method: z
    .enum(HTTP_METHODS as unknown as [HttpMethod, ...HttpMethod[]])
    .describe(
      "HTTP method. The method itself is the read/write/delete classifier — GET is read-only, POST/PUT/PATCH are blocked when --read-only is set, DELETE additionally requires --allow-deletes. The agent cannot bypass this by lying about intent.",
    ),
  path: z
    .string()
    .min(1)
    .describe(
      "Path under the configured Octopus server, e.g. '/api/spaces/Spaces-1/feeds' or '/api/Spaces-1/projects'. Discover paths via grep_llms_txt.",
    ),
  query: z
    .record(z.string())
    .optional()
    .describe("Optional query-string parameters as a flat object."),
  body: z
    .unknown()
    .optional()
    .describe("Optional request body for POST/PUT/PATCH calls."),
  asCsv: z
    .boolean()
    .optional()
    .describe(
      "If true, request 'text/csv' for tabular GET responses. The Octopus API honours this for endpoints that support CSV output.",
    ),
  confirm: z
    .boolean()
    .optional()
    .describe(
      "Required only when the MCP client does not support elicitation. Set to true to confirm a non-GET call; otherwise the tool aborts.",
    ),
};

export function registerExecuteTool(server: McpServer) {
  server.registerTool(
    "execute",
    {
      title: "Execute an Octopus REST request (backstop)",
      description: `Reach Octopus REST endpoints not covered by the curated tools. Use this only after grep_llms_txt has shown you the right method and path.

**Method gating is hard-coded server-side, three tiers:**

  - GET    → read tier: always allowed (subject to toolset allowlist + sensitive denylist).
  - POST/PUT/PATCH → write tier: blocked when --read-only is set; requires user confirmation via elicitation otherwise.
  - DELETE → delete tier: requires --allow-deletes (and is blocked when --read-only is set) AND a stronger user confirmation.

The HTTP method enum is the gate. The tool will not honour any 'isRead' flag the agent invents — the runtime classifies based on the actual method.

**Other gates** (in order):
  1. Sensitive denylist: API key endpoints and catastrophic deletes (DELETE /api/users/{id}, DELETE /api/spaces/{id}) are always blocked.
  2. Path allowlist — only applied when --toolsets has narrowed the active set. With every toolset enabled (the default, or explicit --toolsets all) any path under /api is reachable subject to the other gates; when toolsets are narrowed, paths only resolve if their owning toolset is enabled so disabling a toolset (e.g. 'certificates') makes its endpoints unreachable even on GET.
  3. Elicitation on every non-GET, with a stronger message for DELETE.

Discover endpoints with grep_llms_txt. Use octopus://api/capabilities to see which toolsets are enabled and whether write/delete modes are on.`,
      inputSchema,
      annotations: DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const params = args as ExecuteParams;
      const { method, path: rawPath, query, body, asCsv } = params;
      const tier = classifyMethod(method);
      const audit = startAudit({ method, tier, path: rawPath });
      const config = getActiveToolsetConfig();
      const readOnlyMode = config.readOnlyMode ?? false;
      const allowDeletes = config.allowDeletes ?? false;

      // Gate 0: path canonicalization. Reject paths that can mean different
      // things to the allowlist matcher and the HTTP client (`..` traversal,
      // encoded slashes, query strings, fragments, backslashes). Runs FIRST
      // so a traversal attempt cannot pass any later gate.
      const validation = validateExecutePath(rawPath);
      if (!validation.ok) {
        audit("blocked", "invalidPath");
        return errorResponse({
          success: false,
          reason: "invalidPath",
          message: `Invalid path: ${validation.reason}`,
        });
      }
      const path = validation.path;

      // Gate 1: sensitive denylist (always-on, applies regardless of mode).
      const sensitive = isSensitive(method, path);
      if (sensitive.blocked) {
        audit("blocked", "sensitivePath");
        return errorResponse({
          success: false,
          reason: "sensitivePath",
          message: `Path '${path}' is on the sensitive denylist and cannot be reached via execute. ${sensitive.reason ?? ""}`.trim(),
        });
      }

      // Gate 2: tier-based mode gate.
      if (tier === "write" && readOnlyMode) {
        audit("blocked", "readOnlyMode");
        return errorResponse({
          success: false,
          reason: "readOnlyMode",
          message:
            "This server is in read-only mode. Restart without --read-only to enable write requests through the execute tool.",
        });
      }
      if (tier === "delete") {
        if (readOnlyMode) {
          audit("blocked", "readOnlyMode");
          return errorResponse({
            success: false,
            reason: "readOnlyMode",
            message:
              "This server is in read-only mode. Restart without --read-only AND with --allow-deletes to permit DELETE requests through the execute tool.",
          });
        }
        if (!allowDeletes) {
          audit("blocked", "deletesNotAllowed");
          return errorResponse({
            success: false,
            reason: "deletesNotAllowed",
            message:
              "DELETE requests are not permitted. Restart with --allow-deletes to enable them. This is a deliberate opt-in for irreversible operations.",
          });
        }
      }

      // Gate 3: path allowlist by enabled toolset.
      //
      // The allowlist exists only as the kill-switch for narrowed toolsets:
      // when the operator says `--toolsets releases`, paths under projects /
      // certificates / etc. must be unreachable through execute as well as
      // through the curated tools. When *all* toolsets are enabled (the
      // default, and the explicit `--toolsets all`), there is no scope to
      // enforce — applying the allowlist there would turn it into a stale
      // hand-rolled enumeration that blocks legitimate endpoints (e.g.
      // /feeds, /scopedusersroles) that grep_llms_txt would have surfaced.
      // So we skip it. The other gates (canonicalization, sensitive denylist,
      // method tier, confirmation) still apply.
      if (config.enabledToolsets !== "all" && config.enabledToolsets != null) {
        const enabledToolsets = resolveEnabledToolsets();
        const allowed = matchPath(path, enabledToolsets);
        if (!allowed.matched) {
          const owner = findOwningToolset(path);
          audit("blocked", "pathNotAllowed");
          return errorResponse({
            success: false,
            reason: "pathNotAllowed",
            message: owner
              ? `Path '${path}' belongs to the '${owner}' toolset which is not enabled in this session. Enable it via --toolsets to reach this endpoint.`
              : `Path '${path}' is not on the execute allowlist for any toolset. If this is a legitimate Octopus endpoint not yet covered, file an issue against the MCP server.`,
          });
        }
      }

      // Gate 4: elicitation on every non-GET.
      if (tier !== "read") {
        const isDelete = tier === "delete";
        const message = isDelete
          ? `IRREVERSIBLE delete operation. Confirm carefully.\n\n${method} ${path}\nQuery: ${JSON.stringify(query ?? {})}\nBody: ${summariseBody(body)}`
          : `${method} ${path}\nQuery: ${JSON.stringify(query ?? {})}\nBody: ${summariseBody(body)}`;
        const confirmation = await requireConfirmation(server, {
          message,
          fallbackConfirm: params.confirm,
        });
        if (!confirmation.confirmed) {
          audit("cancelled", confirmation.reason);
          return unconfirmedResponse(confirmation, {
            action: isDelete ? "deletion" : "API call",
          });
        }
      }

      // All gates passed. Dispatch.
      try {
        const client = await Client.create(
          getClientConfigurationFromEnvironment(),
        );
        const requestQuery = asCsv
          ? { ...(query ?? {}), format: "csv" }
          : query;
        const result = await dispatchExecute(
          client,
          method,
          path,
          requestQuery,
          body,
        );
        audit("ok");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                method,
                path,
                tier,
                response: result,
              }),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        audit("error", message);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  reason: "octopusError",
                  method,
                  path,
                  tier,
                  message,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}

registerToolDefinition({
  toolName: "execute",
  // execute is not statically read-only — its tier depends on the HTTP method
  // passed in. methodGated: true keeps it registered even in --read-only mode
  // (where only its GET branch is reachable), and the catalog surfaces the
  // honest `readOnly: false` so clients don't auto-classify it as a reader.
  config: { toolset: "core", readOnly: false, methodGated: true },
  registerFn: registerExecuteTool,
});
