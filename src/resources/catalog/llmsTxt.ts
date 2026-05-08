import { Client } from "@octopusdeploy/api-client";
import { registerResourceDescriptor } from "../../types/resourceConfig.js";
import { getClientConfigurationFromEnvironment } from "../../helpers/getClientConfigurationFromEnvironment.js";

const LLMS_TXT_PATH = "~/api/experimental/llms.txt";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  body: string;
  fetchedAt: number;
}

// Module-scoped cache keyed on the configured Octopus server URL. llms.txt
// only changes when Octopus itself ships a new version; refetching on every
// resource read or every grep call would burn ~360 KB of bandwidth and add
// latency to every catalog query.
const cache = new Map<string, CacheEntry>();

/**
 * Fetch llms.txt for the configured Octopus server, with a 5-minute TTL cache.
 * Exposed so grep_llms_txt can share the same cache.
 */
export async function fetchLlmsTxt(): Promise<string> {
  const configuration = getClientConfigurationFromEnvironment();
  const cacheKey = configuration.instanceURL ?? "(unknown)";
  const now = Date.now();

  const hit = cache.get(cacheKey);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.body;
  }

  const client = await Client.create(configuration);
  const body = await client.getRaw(LLMS_TXT_PATH);
  cache.set(cacheKey, { body, fetchedAt: now });
  return body;
}

/** Test seam: clear the cache between tests. */
export function clearLlmsTxtCache(): void {
  cache.clear();
}

registerResourceDescriptor({
  name: "catalog-llms-txt",
  uriTemplate: "octopus://api/llms.txt",
  toolset: "core",
  title: "Octopus API catalog (llms.txt)",
  description:
    "Markdown catalog of every Octopus REST endpoint, including HTTP method, path, query params, and request/response types. Large (~300+ KB) — prefer the grep_llms_txt tool to search it instead of reading the whole body. Requires Octopus Server 2026.2.3916 or later (the /api/experimental/llms.txt endpoint shipped in that release).",
  mimeType: "text/markdown",
  read: async () => ({
    mimeType: "text/markdown",
    text: await fetchLlmsTxt(),
  }),
});
