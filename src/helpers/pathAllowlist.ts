// Path allowlist for the `execute` backstop tool, scoped per toolset.
//
// The mapping says: "if toolset X is enabled, these path patterns are
// reachable through execute". When a toolset is disabled, all of its patterns
// disappear — turning off `releases` makes the release endpoints unreachable
// regardless of HTTP method or read-only mode. This is the kill-switch model.
//
// **The allowlist is only consulted when toolsets have been narrowed.** When
// every toolset is enabled (the default, or explicit `--toolsets all`), the
// `execute` tool skips this gate entirely — there is no scope to enforce, and
// applying the allowlist would otherwise act as a stale hand-rolled
// enumeration that blocks legitimate Octopus endpoints (`/feeds`,
// `/scopedusersroles`, etc.) that `grep_llms_txt` would have surfaced. So
// **do not** treat the patterns below as the canonical "set of endpoints the
// MCP server supports" — they are only the kill-switch policy.
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
    // `projects` toolset's `/api/*/projects/**` wildcard ALSO matches these,
    // but the most-specific-match-wins logic in matchPath/findOwningToolset
    // (below) attributes them to `featureToggles` because these patterns
    // have more literal segments. So disabling `featureToggles` is a real
    // kill switch — the path becomes unreachable through `execute` even
    // when `projects` is still enabled.
    "/api/*/projects/*/featuretoggles",
    "/api/*/projects/*/featuretoggles/**",
    "/api/spaces/*/projects/*/featuretoggles",
    "/api/spaces/*/projects/*/featuretoggles/**",
  ],
  events: [
    // Space-scoped audit log endpoints.
    ...spaceScoped("events"),
    // Unscoped metadata endpoints (categories, groups, agents, documenttypes).
    // These are server-wide constants with no space prefix. They live in the
    // `events` toolset rather than `core` so disabling `--toolsets ... events`
    // is a real kill switch.
    "/api/events",
    "/api/events/**",
  ],
};

// Specificity = count of literal (non-wildcard) segments in the pattern.
// "/api/<wildcard>/projects/<doublewildcard>" has 2 literal segments
// (api, projects). "/api/<wildcard>/projects/<wildcard>/featuretoggles"
// has 3 (api, projects, featuretoggles). The more-literal pattern wins
// ownership when multiple toolsets claim the same path. This makes nested
// concerns (feature toggles under projects, kubernetes live-status under
// machines) into real kill switches rather than honour-system overlays.
function patternSpecificity(pattern: string): number {
  return pattern
    .split("/")
    .filter((seg) => seg.length > 0 && seg !== "*" && seg !== "**").length;
}

export interface AllowlistMatch {
  matched: boolean;
  toolset?: Toolset;
}

/**
 * Find which toolset owns `path`. Most-specific-match-wins: if multiple
 * toolsets have patterns matching the path, the toolset whose pattern has
 * more literal segments wins ownership. Returns undefined if no toolset
 * claims the path at all.
 *
 * This is the basis for both `matchPath` (allowlist enforcement) and the
 * "which toolset do I need to enable?" error message in `execute`.
 */
export function findOwningToolset(path: string): Toolset | undefined {
  let best: { toolset: Toolset; specificity: number } | null = null;
  for (const toolset of Object.keys(TOOLSET_PATH_PATTERNS) as Toolset[]) {
    for (const pattern of TOOLSET_PATH_PATTERNS[toolset]) {
      if (!pathMatchesGlob(path, pattern)) continue;
      const specificity = patternSpecificity(pattern);
      if (!best || specificity > best.specificity) {
        best = { toolset, specificity };
      }
    }
  }
  return best?.toolset;
}

/**
 * Check whether `path` falls under the allowlist given which toolsets are
 * currently enabled. The `core` toolset is implicitly always enabled.
 *
 * The owning toolset (most-specific match) must be the one enabled — a
 * less-specific toolset whose wildcard happens to also match cannot shadow
 * a disabled, more-specific owner. So `featureToggles` paths require the
 * `featureToggles` toolset, even when `projects` (whose `/projects/**`
 * wildcard also matches) is enabled.
 */
export function matchPath(
  path: string,
  enabledToolsets: readonly Toolset[],
): AllowlistMatch {
  const owner = findOwningToolset(path);
  if (!owner) return { matched: false };

  const isEnabled = owner === "core" || enabledToolsets.includes(owner);
  return isEnabled
    ? { matched: true, toolset: owner }
    : { matched: false, toolset: owner };
}
