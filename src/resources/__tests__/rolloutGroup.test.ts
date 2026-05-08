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

function descriptor(name: string): ResourceDescriptor {
  const d = RESOURCE_REGISTRY.find((r) => r.name === name);
  if (!d) throw new Error(`Resource '${name}' not registered.`);
  return d;
}

describe("rolloutGroup resource", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("fetches the group at the project-scoped rollout-groups path and strips Links", async () => {
    get.mockResolvedValueOnce({
      Id: "RolloutGroups-3",
      Name: "Beta wave",
      FeatureToggleUsages: [
        { Id: "FeatureToggles-9", Name: "checkout-redesign" },
      ],
      Links: {
        Self: "/api/Spaces-1/projects/Projects-123/featuretoggles/rollout-groups/RolloutGroups-3",
      },
    });

    const payload = await descriptor("rolloutGroup").read({
      spaceName: "Default",
      projectId: "Projects-123",
      rolloutGroupId: "RolloutGroups-3",
    });

    const body = JSON.parse(payload.text);
    expect(body.Links).toBeUndefined();
    expect(body.FeatureToggleUsages).toHaveLength(1);

    expect(get).toHaveBeenCalledWith(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles/rollout-groups/{rolloutGroupId}",
      {
        spaceId: "Spaces-1",
        projectId: "Projects-123",
        rolloutGroupId: "RolloutGroups-3",
      },
    );
  });
});
