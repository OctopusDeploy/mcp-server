/**
 * Path allowlist for the `execute` backstop tool, scoped per toolset.
 *
 * The mapping says: "if toolset X is enabled, these path patterns are
 * reachable through execute". When a toolset is disabled, all of its patterns
 * disappear — so turning off `audit` means `/api/events*` is unreachable
 * regardless of HTTP method or read-only mode.
 *
 * The allowlist is deliberately conservative at launch. It enumerates paths
 * the existing curated tools already cover plus the obvious neighbours
 * (e.g. siblings of `/api/projects` like `/api/projects/{id}/channels`).
 * Expand based on real usage; do not pre-emptively enumerate every Octopus
 * endpoint up front.
 *
 * Pattern syntax is the shared `compilePathGlob` engine — `*` matches one
 * segment, `**` matches across segments. Patterns are anchored to the full
 * path, so `/api/projects` does NOT match `/api/projects/Projects-1`; use
 * `/api/projects/**` for the latter.
 *
 * Space-prefixed paths: many Octopus endpoints accept either
 * `/api/{spaceId}/...` or `/api/spaces/{spaceIdentifier}/...`. Both forms are
 * covered by `/api/*\/projects/**` (the leading `*` matches either the bare
 * space ID or the literal `spaces` segment, and `**` covers everything after).
 */

import { type Toolset } from "../types/toolConfig.js";
import { pathMatchesGlob } from "./pathGlob.js";

const TOOLSET_PATH_PATTERNS: Record<Toolset, readonly string[]> = {
  core: [
    "/api",
    "/api/users/me",
    "/api/users/me/permissions/**",
    "/api/spaces",
    "/api/spaces/**",
    "/api/serverstatus/**",
    "/api/experimental/**",
  ],
  projects: [
    "/api/*/projects",
    "/api/*/projects/**",
    "/api/*/projectgroups",
    "/api/*/projectgroups/**",
    "/api/*/lifecycles",
    "/api/*/lifecycles/**",
  ],
  deployments: [
    "/api/*/deployments",
    "/api/*/deployments/**",
    "/api/*/deploymentprocesses",
    "/api/*/deploymentprocesses/**",
    "/api/*/dashboard/**",
  ],
  releases: [
    "/api/*/releases",
    "/api/*/releases/**",
    "/api/*/channels",
    "/api/*/channels/**",
  ],
  runbooks: [
    "/api/*/runbooks",
    "/api/*/runbooks/**",
    "/api/*/runbookruns",
    "/api/*/runbookruns/**",
    "/api/*/runbookprocesses",
    "/api/*/runbookprocesses/**",
    "/api/*/runbooksnapshots",
    "/api/*/runbooksnapshots/**",
  ],
  tasks: ["/api/tasks", "/api/tasks/**"],
  tenants: [
    "/api/*/tenants",
    "/api/*/tenants/**",
    "/api/*/tenantvariables",
    "/api/*/tenantvariables/**",
  ],
  kubernetes: [
    "/api/*/machines/*/livestatus/**",
    "/api/*/machines/*/connection/**",
  ],
  machines: [
    "/api/*/machines",
    "/api/*/machines/**",
    "/api/*/workers",
    "/api/*/workers/**",
    "/api/*/workerpools",
    "/api/*/workerpools/**",
  ],
  context: [
    "/api/*/environments",
    "/api/*/environments/**",
    "/api/*/variables",
    "/api/*/variables/**",
  ],
  certificates: [
    "/api/*/certificates",
    "/api/*/certificates/**",
  ],
  accounts: [
    "/api/*/accounts",
    "/api/*/accounts/**",
  ],
  interruptions: [
    "/api/*/interruptions",
    "/api/*/interruptions/**",
  ],
};

export interface AllowlistMatch {
  matched: boolean;
  toolset?: Toolset;
}

/**
 * Check whether `path` falls under the allowlist for any currently-enabled
 * toolset. The `core` toolset is implicitly always enabled; callers do not
 * need to include it in `enabledToolsets`.
 */
export function matchPath(
  path: string,
  enabledToolsets: readonly Toolset[],
): AllowlistMatch {
  const candidates: Toolset[] = [
    "core",
    ...enabledToolsets.filter((t) => t !== "core"),
  ];
  for (const toolset of candidates) {
    for (const pattern of TOOLSET_PATH_PATTERNS[toolset]) {
      if (pathMatchesGlob(path, pattern)) {
        return { matched: true, toolset };
      }
    }
  }
  return { matched: false };
}

/**
 * Find which toolset would have allowed `path` if it were enabled. Used to
 * produce a helpful error response that names the toolset the user needs to
 * turn on.
 */
export function findOwningToolset(path: string): Toolset | undefined {
  for (const toolset of Object.keys(TOOLSET_PATH_PATTERNS) as Toolset[]) {
    for (const pattern of TOOLSET_PATH_PATTERNS[toolset]) {
      if (pathMatchesGlob(path, pattern)) {
        return toolset;
      }
    }
  }
  return undefined;
}
