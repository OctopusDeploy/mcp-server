import { describe, it, expect, beforeEach, vi } from "vitest";

const getRaw = vi.fn();

vi.mock("../../../helpers/getClientConfigurationFromEnvironment.js", () => ({
  getClientConfigurationFromEnvironment: () => ({
    instanceURL: "https://octopus.example",
    apiKey: "API-TEST",
  }),
}));

vi.mock("@octopusdeploy/api-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@octopusdeploy/api-client")>();
  return {
    ...actual,
    Client: { create: vi.fn(async () => ({ getRaw })) },
  };
});

import { fetchLlmsTxt, clearLlmsTxtCache } from "../llmsTxt.js";
import "../llmsTxt.js"; // ensure descriptor registers
import {
  RESOURCE_REGISTRY,
  type ResourceDescriptor,
} from "../../../types/resourceConfig.js";

function descriptorByName(name: string): ResourceDescriptor {
  const descriptor = RESOURCE_REGISTRY.find((d) => d.name === name);
  if (!descriptor) {
    throw new Error(`Resource descriptor '${name}' is not registered.`);
  }
  return descriptor;
}

describe("octopus://api/llms.txt resource", () => {
  beforeEach(() => {
    getRaw.mockReset();
    clearLlmsTxtCache();
  });

  it("fetches the body via Client.getRaw on the experimental llms.txt path", async () => {
    getRaw.mockResolvedValue("# Octopus Deploy API\n\nbody");

    const body = await fetchLlmsTxt();

    expect(body).toBe("# Octopus Deploy API\n\nbody");
    expect(getRaw).toHaveBeenCalledWith("~/api/experimental/llms.txt");
  });

  it("returns the cached body on subsequent calls within the TTL", async () => {
    getRaw.mockResolvedValue("cached body");

    await fetchLlmsTxt();
    await fetchLlmsTxt();
    await fetchLlmsTxt();

    expect(getRaw).toHaveBeenCalledTimes(1);
  });

  it("refetches after the cache is cleared (test seam for TTL expiry)", async () => {
    getRaw.mockResolvedValue("first");
    await fetchLlmsTxt();
    expect(getRaw).toHaveBeenCalledTimes(1);

    clearLlmsTxtCache();
    getRaw.mockResolvedValue("second");
    const second = await fetchLlmsTxt();

    expect(second).toBe("second");
    expect(getRaw).toHaveBeenCalledTimes(2);
  });

  it("registers a descriptor at octopus://api/llms.txt with text/markdown mime type", () => {
    const descriptor = descriptorByName("catalog-llms-txt");

    expect(descriptor.uriTemplate).toBe("octopus://api/llms.txt");
    expect(descriptor.mimeType).toBe("text/markdown");
    expect(descriptor.toolset).toBe("core");
  });

  it("descriptor.read returns the body verbatim with the markdown mime type", async () => {
    getRaw.mockResolvedValue("# heading");
    const descriptor = descriptorByName("catalog-llms-txt");

    const payload = await descriptor.read({});

    expect(payload).toEqual({ mimeType: "text/markdown", text: "# heading" });
  });
});
