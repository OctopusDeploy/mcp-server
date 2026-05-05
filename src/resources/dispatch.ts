/**
 * Registry-driven dispatch for octopus:// resource URIs.
 *
 * Both the Resource Template registrations (src/resources/index.ts) and the
 * `read_resource` Tool backstop (src/tools/readResource.ts) flow through the
 * same descriptor registry, so resource-aware clients (which call resources/read)
 * and resource-less clients (which call the Tool wrapper) hit identical logic.
 */

import { UriTemplate } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import {
  RESOURCE_REGISTRY,
  type ResourceDescriptor,
  type ResourcePayload,
} from "../types/resourceConfig.js";

const COMPILED = new WeakMap<ResourceDescriptor, UriTemplate>();

function compiled(descriptor: ResourceDescriptor): UriTemplate {
  let template = COMPILED.get(descriptor);
  if (!template) {
    template = new UriTemplate(descriptor.uriTemplate);
    COMPILED.set(descriptor, template);
  }
  return template;
}

/**
 * Pick the first value for each variable and URL-decode it.
 *
 * The SDK's UriTemplate.match captures regex groups as raw strings (no decoding),
 * so an input URI like `octopus://spaces/AI%20Foundations/releases/Releases-1`
 * yields `spaceName = "AI%20Foundations"` here. Decoding makes the variables
 * usable directly against the Octopus API, which expects the literal `AI Foundations`.
 *
 * Falls back to the raw value if a string contains an invalid percent-escape so
 * a malformed input surfaces as a clearer downstream error rather than a URIError.
 */
export function flatten(
  variables: Record<string, string | string[]>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    const first = Array.isArray(value) ? (value[0] ?? "") : value;
    out[key] = safeDecode(first);
  }
  return out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function dispatchOctopusUri(
  uri: string,
): Promise<ResourcePayload | null> {
  if (!uri.startsWith("octopus://")) return null;

  for (const descriptor of RESOURCE_REGISTRY) {
    const variables = compiled(descriptor).match(uri);
    if (variables) {
      return descriptor.read(flatten(variables));
    }
  }

  return null;
}
