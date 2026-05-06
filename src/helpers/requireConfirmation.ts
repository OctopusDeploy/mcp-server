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
      message: opts.message,
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
