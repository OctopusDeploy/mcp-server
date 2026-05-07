import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { env } from "process";

export interface RequireConfirmationOptions {
  /** Human-readable summary of what will happen, shown to the user. */
  message: string;
  /**
   * Yes/no value from the calling tool's own args. Used only when the client
   * does not advertise elicitation capability. Tool input schemas should add
   * `confirm: z.boolean().optional()` and pass it through here.
   *
   * Resolution when the elicitation capability is absent:
   *   - `true`     → confirmed (the LLM asserts the user approved out-of-band)
   *   - `false`    → declined (the LLM asserts the user said no out-of-band)
   *   - `undefined`→ confirmationRequired (the user hasn't been asked yet — the
   *                  caller should report this back to the LLM as a hard error
   *                  so it asks the user before retrying)
   */
  fallbackConfirm?: boolean;
  /**
   * Optional structured before/after view of the operation. Rendered as JSON
   * and appended to `message` so the user sees the exact command that will be
   * executed before approving — including modifiers like scheduled run time,
   * skipped steps, machine filters, prompted variables, deployment-freeze
   * overrides, etc. that don't fit the prose summary.
   *
   *   - Create operations: `{ source: {}, target: <command body> }`.
   *   - Modify operations: `source` is the current state; `target` is the
   *     proposed state. Callers may pre-filter both sides to only the changed
   *     fields so the prompt isn't dominated by unchanged values.
   *
   * Kept inside `message` rather than surfaced as a `requestedSchema` so the
   * rendering is identical across clients regardless of which elicitation
   * modes they support.
   */
  change?: {
    source: Record<string, unknown>;
    target: Record<string, unknown>;
  };
}

function renderChange(change: {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
}): string {
  return [
    "source:",
    JSON.stringify(change.source, null, 2),
    "target:",
    JSON.stringify(change.target, null, 2),
  ].join("\n");
}

function buildConfirmationMessage(
  message: string,
  change?: RequireConfirmationOptions["change"],
): string {
  return change ? `${message}\n\n${renderChange(change)}` : message;
}

/**
 * Why the helper resolved the way it did. Tools branch on this so the LLM
 * (and any humans reading logs) can tell an explicit user "no" apart from a
 * confirmation that was never reachable in the first place.
 */
export type ConfirmationReason =
  /** OCTOPUS_SKIP_ELICITATION=true bypass. */
  | "envSkip"
  /** User clicked Accept on the elicitation prompt. */
  | "accepted"
  /** Caller passed fallbackConfirm: true (no elicitation capability). */
  | "fallbackConfirm"
  /** User clicked Decline on the elicitation prompt, or fallbackConfirm was explicitly false. */
  | "declined"
  /** User dismissed the elicitation prompt without choosing. */
  | "cancelled"
  /**
   * Client does not advertise elicitation capability AND fallbackConfirm was
   * not provided. The user has NOT been asked. Tools should surface this as a
   * hard error and tell the LLM to ask the user before retrying.
   */
  | "confirmationRequired";

export type ConfirmationResult =
  | { confirmed: true; reason: "envSkip" | "accepted" | "fallbackConfirm" }
  | {
      confirmed: false;
      reason: "declined" | "cancelled" | "confirmationRequired";
    };

/**
 * Gate a write/destructive tool call on explicit user confirmation.
 *
 * Resolution order:
 *   1. `OCTOPUS_SKIP_ELICITATION=true` env var → bypass (automation/CI).
 *   2. Client advertises elicitation capability → SDK emits `elicitation/create`
 *      and we map `result.action` to accepted/declined/cancelled.
 *   3. Client does not advertise elicitation → fall back to the `confirm` arg
 *      the tool surfaced in its own input schema. Distinguishes between
 *      explicit `false` (declined) and missing (confirmationRequired) so the
 *      caller can surface the latter as a hard error.
 */
export async function requireConfirmation(
  server: McpServer,
  opts: RequireConfirmationOptions,
): Promise<ConfirmationResult> {
  if (env["OCTOPUS_SKIP_ELICITATION"] === "true") {
    return { confirmed: true, reason: "envSkip" };
  }

  const capabilities = server.server.getClientCapabilities();
  if (capabilities?.elicitation) {
    const result = await server.server.elicitInput({
      mode: "form",
      message: buildConfirmationMessage(opts.message, opts.change),
      // Empty properties → most clients render as a plain Accept/Decline prompt.
      requestedSchema: { type: "object", properties: {} },
    });
    switch (result.action) {
      case "accept":
        return { confirmed: true, reason: "accepted" };
      case "decline":
        return { confirmed: false, reason: "declined" };
      case "cancel":
      default:
        return { confirmed: false, reason: "cancelled" };
    }
  }

  if (opts.fallbackConfirm === true) {
    return { confirmed: true, reason: "fallbackConfirm" };
  }
  if (opts.fallbackConfirm === false) {
    return { confirmed: false, reason: "declined" };
  }
  return { confirmed: false, reason: "confirmationRequired" };
}

export interface UnconfirmedResponseOptions {
  /**
   * Lowercase noun phrase describing the gated action — e.g. "release
   * creation", "deployment", "runbook run". Embedded mid-sentence in the
   * `confirmationRequired` message and capitalized for the cancelled message.
   */
  action: string;
}

/**
 * Build the standard tool response for a non-confirmed gate result.
 *
 *   - `confirmationRequired` → `isError: true` with directive prose telling the
 *     LLM to ask the user before retrying with `confirm: true`. This is the
 *     "user was never asked" branch — distinct from a real cancellation, and
 *     marked as an error so the LLM doesn't paper over it.
 *   - `declined` / `cancelled` → soft cancellation shape with the original
 *     reason preserved for telemetry.
 *
 * Centralized here so every gated tool produces identical responses; the only
 * thing a caller varies is the `action` noun. Return type is inferred so it
 * stays compatible with the SDK's tool-handler return shape (which carries an
 * `[key: string]: unknown` index signature we don't want to redeclare).
 */
export function unconfirmedResponse(
  result: Extract<ConfirmationResult, { confirmed: false }>,
  opts: UnconfirmedResponseOptions,
) {
  if (result.reason === "confirmationRequired") {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: false,
              confirmationRequired: true,
              message:
                `This MCP client does not support elicitation, so the server cannot prompt the user to confirm this ${opts.action} directly. ` +
                `The user has NOT been asked. Stop and ask the user explicitly whether to proceed; if they approve, retry the call with confirm: true. ` +
                `Do not pass confirm: true without their explicit approval.`,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  const capitalized =
    opts.action.charAt(0).toUpperCase() + opts.action.slice(1);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: false,
            cancelled: true,
            reason: result.reason,
            message: `${capitalized} cancelled by user.`,
          },
          null,
          2,
        ),
      },
    ],
  };
}
