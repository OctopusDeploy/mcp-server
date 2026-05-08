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
import "../featureToggle.js";

function descriptor(name: string): ResourceDescriptor {
  const d = RESOURCE_REGISTRY.find((r) => r.name === name);
  if (!d) throw new Error(`Resource '${name}' not registered.`);
  return d;
}

describe("featureToggle resource", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("fetches the toggle by slug at the project-scoped path and strips the HATEOAS Links bag", async () => {
    get.mockResolvedValueOnce({
      Id: "FeatureToggles-9",
      Slug: "checkout-redesign",
      Environments: [
        {
          DeploymentEnvironmentId: "Environments-7",
          Segments: [{ Key: "browser", Value: "Chrome" }],
          MinimumVersion: "1.4.0",
        },
      ],
      RolloutGroupId: "RolloutGroups-3",
      Links: { Self: "/api/Spaces-1/projects/Projects-123/featuretoggles/checkout-redesign" },
    });

    const payload = await descriptor("featureToggle").read({
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
    });

    const body = JSON.parse(payload.text);
    expect(body.Links).toBeUndefined();
    // Heavy fields the slim summary omits are present in the resource.
    expect(body.Environments[0].Segments).toEqual([
      { Key: "browser", Value: "Chrome" },
    ]);
    expect(body.Environments[0].MinimumVersion).toBe("1.4.0");

    expect(get).toHaveBeenCalledWith(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles/{slug}",
      {
        spaceId: "Spaces-1",
        projectId: "Projects-123",
        slug: "checkout-redesign",
      },
    );
  });
});
