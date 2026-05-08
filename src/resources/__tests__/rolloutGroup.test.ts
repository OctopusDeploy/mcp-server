import { describe, it, expect, beforeEach, vi } from "vitest";

const get = vi.fn();
const resolveSpaceId = vi.fn();

vi.mock("../../helpers/getClientConfigurationFromEnvironment.js", () => ({
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
    Client: { create: vi.fn(async () => ({ get })) },
    resolveSpaceId: (...args: unknown[]) => resolveSpaceId(...args),
  };
});

import {
  RESOURCE_REGISTRY,
  type ResourceDescriptor,
} from "../../types/resourceConfig.js";
import "../rolloutGroup.js";

function descriptorByName(name: string): ResourceDescriptor {
  const descriptor = RESOURCE_REGISTRY.find((d) => d.name === name);
  if (!descriptor) {
    throw new Error(`Resource descriptor '${name}' is not registered.`);
  }
  return descriptor;
}

const sampleGroup = {
  Id: "RolloutGroups-3",
  SpaceId: "Spaces-1",
  ProjectId: "Projects-123",
  Name: "Beta wave",
  FeatureToggleUsages: [
    { Id: "FeatureToggles-9", Name: "checkout-redesign" },
    { Id: "FeatureToggles-12", Name: "search-overhaul" },
  ],
  Links: {
    Self: "/api/Spaces-1/projects/Projects-123/featuretoggles/rollout-groups/RolloutGroups-3",
  },
};

describe("rolloutGroup resource", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("returns the full group body with Links stripped", async () => {
    get.mockResolvedValueOnce(sampleGroup);

    const payload = await descriptorByName("rolloutGroup").read({
      spaceName: "Default",
      projectId: "Projects-123",
      rolloutGroupId: "RolloutGroups-3",
    });

    expect(payload.mimeType).toBe("application/json");
    const body = JSON.parse(payload.text);

    expect(body.Links).toBeUndefined();
    expect(body.Name).toBe("Beta wave");
    expect(body.FeatureToggleUsages).toHaveLength(2);

    expect(get).toHaveBeenCalledWith(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles/rollout-groups/{rolloutGroupId}",
      {
        spaceId: "Spaces-1",
        projectId: "Projects-123",
        rolloutGroupId: "RolloutGroups-3",
      },
    );
  });

  it("rejects an invalid rollout group ID before any API call", async () => {
    await expect(
      descriptorByName("rolloutGroup").read({
        spaceName: "Default",
        projectId: "Projects-123",
        rolloutGroupId: "not-a-real-id",
      }),
    ).rejects.toThrow(/Invalid rollout group ID format/);

    expect(get).not.toHaveBeenCalled();
    expect(resolveSpaceId).not.toHaveBeenCalled();
  });

  it("translates 404 into a friendly error", async () => {
    get.mockRejectedValueOnce(new Error("404 not found"));

    await expect(
      descriptorByName("rolloutGroup").read({
        spaceName: "Default",
        projectId: "Projects-123",
        rolloutGroupId: "RolloutGroups-99",
      }),
    ).rejects.toThrow(/not found in space 'Default'/);
  });
});
