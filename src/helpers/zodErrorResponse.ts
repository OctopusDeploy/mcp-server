import { z } from "zod";

/**
 * Wrap a Zod parse error in the structured tool-response shape used across
 * tools whose published inputSchema is a plain `z.object(...)` (so the MCP SDK
 * can read `.shape`) and whose cross-field invariants live on a separate
 * `.superRefine(...)` schema, evaluated inside the handler.
 *
 * See the SDK-workaround comment on the find_events / run_runbook input
 * schemas for the underlying reason this split exists.
 */
export function zodErrorResponse(error: z.ZodError) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: false,
            error: "Invalid argument combination",
            issues: error.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          },
          null,
          2,
        ),
      },
    ],
    isError: true as const,
  };
}
