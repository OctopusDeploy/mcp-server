// Path allowlist for the `execute` backstop tool, scoped per toolset.
//
// The mapping says: "if toolset X is enabled, these path patterns are
// reachable through execute". When a toolset is disabled, all of its patterns
// disappear — turning off `releases` makes the release endpoints unreachable
// regardless of HTTP method or read-only mode. This is the kill-switch model.
//
// **`core` is intentionally narrow.** It only covers space discovery,
// server-level metadata, and the API catalog. It does NOT contain a wildcard
// over space sub-paths — every per-resource path under a space must be
// registered against its owning toolset. Anything else would let `core`
// (which is always enabled and consulted first) defeat per-toolset filtering
// for every space-scoped endpoint.
//
// **Each toolset registers BOTH space-prefix forms.** Octopus accepts
// `/api/{spaceId}/X` and `/api/spaces/{spaceIdentifier}/X` interchangeably, so
// each toolset declares both — `/api/<single>/projects` covers the
// bare-space-ID form, and `/api/spaces/<single>/projects` covers the
// `/spaces/{slug-or-id}` form. The shared glob engine treats `*` as a single
// segment, so both patterns are needed.
//
// Pattern syntax is the shared `compilePathGlob` engine — `*` matches one
// segment, `**` matches across segments. Patterns are anchored to the full
// path: `/api/projects` does NOT match `/api/projects/Projects-1`; use
// `/api/projects/**` for the latter.
//
// The allowlist is deliberately conservative at launch — it enumerates paths
// the existing curated tools already cover plus the obvious neighbours.
// Expand based on real usage; do not pre-emptively enumerate every Octopus
// endpoint up front.

import { type Toolset } from "../types/toolConfig.js";
import { pathMatchesGlob } from "./pathGlob.js";

/**
 * Helper: produce the two prefix forms for a space-scoped path suffix.
 *   spacePrefixed("projects") → ["/api/* /projects", "/api/spaces/* /projects"]
 * Returns the bare endpoint and the wildcard sub-path variants for both.
 */
function spaceScoped(suffix: string): readonly string[] {
  return [
    `/api/*/${suffix}`,
    `/api/*/${suffix}/**`,
    `/api/spaces/*/${suffix}`,
    `/api/spaces/*/${suffix}/**`,
  ];
}

const TOOLSET_PATH_PATTERNS: Record<Toolset, readonly string[]> = {
  core: [
    "/api",
    "/api/users/me",
    "/api/users/me/permissions/**",
    "/api/spaces",
    // Top-level Space metadata only — single segment after `/api/spaces`.
    // Per-resource paths beneath a space (`/api/spaces/{id}/projects`, etc.)
    // are NOT in core; they live under their owning toolset.
    "/api/spaces/*",
    "/api/serverstatus/**",
    "/api/experimental/**",
  ],
  projects: [
    ...spaceScoped("projects"),
    ...spaceScoped("projectgroups"),
    ...spaceScoped("lifecycles"),
  ],
  deployments: [
    ...spaceScoped("deployments"),
    ...spaceScoped("deploymentprocesses"),
    ...spaceScoped("dashboard"),
  ],
  releases: [
    ...spaceScoped("releases"),
    ...spaceScoped("channels"),
  ],
  runbooks: [
    ...spaceScoped("runbooks"),
    ...spaceScoped("runbookruns"),
    ...spaceScoped("runbookprocesses"),
    ...spaceScoped("runbooksnapshots"),
  ],
  tasks: ["/api/tasks", "/api/tasks/**"],
  tenants: [
    ...spaceScoped("tenants"),
    ...spaceScoped("tenantvariables"),
  ],
  kubernetes: [
    "/api/*/machines/*/livestatus/**",
    "/api/*/machines/*/connection/**",
    "/api/spaces/*/machines/*/livestatus/**",
    "/api/spaces/*/machines/*/connection/**",
  ],
  machines: [
    ...spaceScoped("machines"),
    ...spaceScoped("workers"),
    ...spaceScoped("workerpools"),
  ],
  context: [
    ...spaceScoped("environments"),
    ...spaceScoped("variables"),
  ],
  certificates: [
    ...spaceScoped("certificates"),
  ],
  accounts: [
    ...spaceScoped("accounts"),
  ],
  interruptions: [
    ...spaceScoped("interruptions"),
  ],
  featureToggles: [
    // Customer feature toggles are project-scoped, so the paths nest under
    // /projects/*/featuretoggles rather than directly under the space. The
    // `projects` toolset's `/api/*/projects/**` wildcard would also match
    // these — that's fine, both attributions allow the request through.
    "/api/*/projects/*/featuretoggles",
    "/api/*/projects/*/featuretoggles/**",
    "/api/spaces/*/projects/*/featuretoggles",
    "/api/spaces/*/projects/*/featuretoggles/**",
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
