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

function descriptorByName(name: string): ResourceDescriptor {
  const descriptor = RESOURCE_REGISTRY.find((d) => d.name === name);
  if (!descriptor) {
    throw new Error(`Resource descriptor '${name}' is not registered.`);
  }
  return descriptor;
}

const sampleToggle = {
  Id: "FeatureToggles-9",
  SpaceId: "Spaces-1",
  ProjectId: "Projects-123",
  Name: "checkout-redesign",
  Slug: "checkout-redesign",
  DefaultIsEnabled: false,
  Description: "Rolls out the new checkout flow.",
  Environments: [
    {
      DeploymentEnvironmentId: "Environments-7",
      IsEnabled: true,
      RolloutPercentage: 25,
      ClientRolloutPercentage: 50,
      TenantIds: ["Tenants-42"],
      Segments: [{ Key: "browser", Value: "Chrome" }],
      MinimumVersion: "1.4.0",
    },
  ],
  Tags: ["release-rings/beta"],
  RolloutGroupId: "RolloutGroups-3",
  Links: {
    Self: "/api/Spaces-1/projects/Projects-123/featuretoggles/checkout-redesign",
  },
};

describe("featureToggle resource", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("returns the full toggle body and strips Links", async () => {
    get.mockResolvedValueOnce(sampleToggle);

    const payload = await descriptorByName("featureToggle").read({
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
    });

    expect(payload.mimeType).toBe("application/json");
    const body = JSON.parse(payload.text);

    expect(body.Links).toBeUndefined();
    expect(body.Slug).toBe("checkout-redesign");
    expect(body.Environments[0].Segments).toEqual([
      { Key: "browser", Value: "Chrome" },
    ]);
    expect(body.Environments[0].MinimumVersion).toBe("1.4.0");
    expect(body.RolloutGroupId).toBe("RolloutGroups-3");

    expect(get).toHaveBeenCalledWith(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles/{slug}",
      {
        spaceId: "Spaces-1",
        projectId: "Projects-123",
        slug: "checkout-redesign",
      },
    );
  });

  it("translates 404 from the api-client into a friendly error", async () => {
    get.mockRejectedValueOnce(new Error("Resource not found (404)"));

    await expect(
      descriptorByName("featureToggle").read({
        spaceName: "Default",
        projectId: "Projects-123",
        slug: "missing",
      }),
    ).rejects.toThrow(/not found in space 'Default'/);
  });
});
