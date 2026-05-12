/**
 * Hard-coded read/write/delete classification for HTTP methods used by the
 * `execute` backstop tool. The HTTP method is the authoritative classifier —
 * never something the LLM gets to set independently of the actual call.
 *
 * Tiers:
 *   - read   → GET                       (always allowed, subject to allow/denylists)
 *   - write  → POST, PUT, PATCH          (blocked when --read-only is set)
 *   - delete → DELETE                    (blocked when --read-only is set; also requires --allow-deletes)
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type MethodTier = "read" | "write" | "delete";

export const HTTP_METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;

export function classifyMethod(method: HttpMethod): MethodTier {
  if (method === "GET") return "read";
  if (method === "DELETE") return "delete";
  return "write";
}
