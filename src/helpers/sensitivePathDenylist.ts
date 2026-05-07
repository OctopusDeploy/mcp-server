/**
 * Hard denylist for `execute` paths that must never be reachable, regardless
 * of toolsets or mode flags. These are entries the user cannot opt into via
 * --no-read-only or --allow-deletes.
 *
 * Two categories live here:
 *   1. API-key management — creating or modifying API keys via the MCP server
 *      is structurally out of scope (the agent uses a key already; minting more
 *      from inside the agent is a privilege escalation pattern).
 *   2. Catastrophic deletes — paths whose DELETE removes a top-level container
 *      (a Space, a User) and is operationally irreversible. Allowing the agent
 *      to issue these from a single tool call is too sharp an edge.
 *
 * Pattern syntax is the shared `compilePathGlob` engine: `*` matches one
 * segment, `**` matches across segments, and every other character is literal.
 */

import { type HttpMethod } from "./methodTier.js";
import { pathMatchesGlob } from "./pathGlob.js";

export interface DenyEntry {
  /** Optional method filter; absent = all methods. */
  method?: HttpMethod;
  /** Glob pattern. `*` = one segment, `**` = any number of segments. */
  pattern: string;
  /** Short reason surfaced in the error response. */
  reason: string;
}

export const SENSITIVE_PATHS: readonly DenyEntry[] = [
  {
    pattern: "/api/users/*/apikeys",
    reason:
      "API key management is out of scope for the MCP server. Use the Octopus web portal.",
  },
  {
    pattern: "/api/users/*/apikeys/**",
    reason:
      "API key management is out of scope for the MCP server. Use the Octopus web portal.",
  },
  {
    method: "DELETE",
    pattern: "/api/users/*",
    reason:
      "Deleting a user is irreversible and out of scope for the MCP server.",
  },
  {
    method: "DELETE",
    pattern: "/api/spaces/*",
    reason:
      "Deleting a Space is catastrophic and out of scope for the MCP server.",
  },
];

export interface SensitiveCheckResult {
  blocked: boolean;
  reason?: string;
}

export function isSensitive(
  method: HttpMethod,
  path: string,
  entries: readonly DenyEntry[] = SENSITIVE_PATHS,
): SensitiveCheckResult {
  for (const entry of entries) {
    if (entry.method && entry.method !== method) continue;
    if (pathMatchesGlob(path, entry.pattern)) {
      return { blocked: true, reason: entry.reason };
    }
  }
  return { blocked: false };
}
