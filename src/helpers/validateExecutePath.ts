/**
 * Reject `execute` paths whose canonical form differs from what the allowlist
 * and denylist would see, so a path like
 *
 *     /api/spaces/Spaces-1/../../users/me/apikeys
 *
 * cannot pass the `/api/spaces/**` allowlist while resolving to
 * `/api/users/me/apikeys` on the server.
 *
 * The validator is deliberately conservative: anything that introduces
 * ambiguity between the literal path string and what the HTTP client / Octopus
 * routing will see — `..` segments, encoded slashes, backslashes, query
 * strings, fragments, double slashes — is rejected outright. We do NOT try to
 * normalise the path; rejecting unambiguously is safer than guessing the
 * caller's intent.
 *
 * Query parameters belong in the `query` argument of the execute tool, not
 * inside the `path` string — surfacing that as a reject prompts the agent to
 * use the right field.
 */

export type PathValidation =
  | { ok: true; path: string }
  | { ok: false; reason: string };

export function validateExecutePath(raw: string): PathValidation {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: "Path must be a non-empty string." };
  }
  if (!raw.startsWith("/")) {
    return { ok: false, reason: "Path must start with '/'." };
  }
  if (raw.includes("\\")) {
    return { ok: false, reason: "Path must not contain backslashes." };
  }
  if (raw.includes("?")) {
    return {
      ok: false,
      reason:
        "Path must not contain a query string. Pass query parameters via the `query` argument instead.",
    };
  }
  if (raw.includes("#")) {
    return { ok: false, reason: "Path must not contain a fragment ('#')." };
  }
  if (raw.includes("//")) {
    return { ok: false, reason: "Path must not contain '//'." };
  }
  if (/%2f|%5c/i.test(raw)) {
    return {
      ok: false,
      reason:
        "Path must not contain percent-encoded slashes ('%2F') or backslashes ('%5C').",
    };
  }
  // Reject any `..` segment — exact, leading, trailing, or surrounded by
  // slashes. We do not attempt to resolve them.
  const segments = raw.split("/");
  for (const segment of segments) {
    if (segment === "..") {
      return {
        ok: false,
        reason:
          "Path must not contain '..' segments. Provide the canonical path explicitly.",
      };
    }
  }
  return { ok: true, path: raw };
}
