/**
 * Strip the HATEOAS `Links` bag from an Octopus API response object.
 *
 * Octopus REST responses include a `Links` map of hypermedia URLs (self, related
 * collections, etc.) that an LLM consumer doesn't need and that bloats the payload.
 * Every resource handler that returns an api-client object as JSON should pass it
 * through this helper first.
 *
 * The api-client typings often don't include `Links` on their response interfaces
 * (the runtime payload has it; the typings don't always declare it), which is why
 * the input is widened to `Record<string, unknown>` rather than typed against a
 * specific resource interface.
 */
export function stripLinks(resource: object): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...resource } as Record<string, unknown>;
  delete copy.Links;
  return copy;
}
