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

import { findFeatureTogglesHandler } from "../findFeatureToggles.js";
import { parseToolResponse } from "./testSetup.js";

interface ToggleSummary {
  id: string;
  slug: string;
  name: string;
  projectId: string;
  defaultIsEnabled: boolean;
  rolloutGroupId: string | null;
  tags: string[];
  environmentSummaries: Array<{
    deploymentEnvironmentId: string;
    isEnabled: boolean;
    rolloutPercentage?: number;
    clientRolloutPercentage?: number;
  }>;
  resourceUri: string;
}

interface ListResponse {
  totalResults: number;
  itemsPerPage: number;
  numberOfPages: number;
  lastPageNumber: number;
  items: ToggleSummary[];
}

function makeToggle(overrides: {
  id: number;
  slug?: string;
  name?: string;
  defaultIsEnabled?: boolean;
  rolloutGroupId?: string | null;
  environments?: Array<{
    deploymentEnvironmentId: string;
    isEnabled: boolean;
    rolloutPercentage?: number;
    clientRolloutPercentage?: number;
  }>;
}) {
  return {
    Id: `FeatureToggles-${overrides.id}`,
    SpaceId: "Spaces-1",
    ProjectId: "Projects-123",
    Name: overrides.name ?? `toggle-${overrides.id}`,
    Slug: overrides.slug ?? `toggle-${overrides.id}`,
    DefaultIsEnabled: overrides.defaultIsEnabled ?? false,
    Description: null,
    Environments: (overrides.environments ?? []).map((e) => ({
      DeploymentEnvironmentId: e.deploymentEnvironmentId,
      IsEnabled: e.isEnabled,
      RolloutPercentage: e.rolloutPercentage,
      ClientRolloutPercentage: e.clientRolloutPercentage,
      TenantIds: [],
      ExcludedTenantIds: [],
      TenantTags: [],
      ExcludedTenantTags: [],
      Segments: [],
      MinimumVersion: null,
    })),
    Tags: [],
    RolloutGroupId: overrides.rolloutGroupId ?? null,
  };
}

describe("findFeatureTogglesHandler", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("returns slim summaries with per-environment state and a resource URI", async () => {
    get.mockResolvedValueOnce({
      TotalResults: 1,
      ItemsPerPage: 30,
      NumberOfPages: 1,
      LastPageNumber: 0,
      Items: [
        makeToggle({
          id: 9,
          slug: "checkout-redesign",
          name: "checkout-redesign",
          defaultIsEnabled: false,
          environments: [
            {
              deploymentEnvironmentId: "Environments-7",
              isEnabled: true,
              rolloutPercentage: 25,
              clientRolloutPercentage: 50,
            },
          ],
        }),
      ],
    });

    const response = await findFeatureTogglesHandler({
      spaceName: "Default",
      projectId: "Projects-123",
    });
    const body = parseToolResponse<ListResponse>(response);

    expect(body.totalResults).toBe(1);
    expect(body.items).toHaveLength(1);
    const item = body.items[0];
    expect(item.id).toBe("FeatureToggles-9");
    expect(item.slug).toBe("checkout-redesign");
    expect(item.defaultIsEnabled).toBe(false);
    expect(item.environmentSummaries).toEqual([
      {
        deploymentEnvironmentId: "Environments-7",
        isEnabled: true,
        rolloutPercentage: 25,
        clientRolloutPercentage: 50,
      },
    ]);
    expect(item.resourceUri).toBe(
      "octopus://spaces/Default/projects/Projects-123/featuretoggles/checkout-redesign",
    );
  });

  it("URL-encodes spaceName, projectId, and slug in the resource URI", async () => {
    get.mockResolvedValueOnce({
      TotalResults: 1,
      ItemsPerPage: 30,
      NumberOfPages: 1,
      LastPageNumber: 0,
      Items: [
        makeToggle({
          id: 1,
          slug: "feature/with slashes",
          name: "messy",
        }),
      ],
    });

    const response = await findFeatureTogglesHandler({
      spaceName: "AI Foundations",
      projectId: "Projects-123",
    });
    const body = parseToolResponse<ListResponse>(response);

    expect(body.items[0].resourceUri).toBe(
      "octopus://spaces/AI%20Foundations/projects/Projects-123/featuretoggles/feature%2Fwith%20slashes",
    );
  });

  it("passes filter args through to the URI template", async () => {
    get.mockResolvedValueOnce({
      TotalResults: 0,
      ItemsPerPage: 30,
      NumberOfPages: 1,
      LastPageNumber: 0,
      Items: [],
    });

    await findFeatureTogglesHandler({
      spaceName: "Default",
      projectId: "Projects-123",
      partialName: "checkout",
      tags: ["release-rings/beta", "team/payments"],
      environmentIds: ["Environments-7", "Environments-8"],
      skip: 30,
      take: 30,
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles{?Skip,Take,PartialName,Tags,Environments}",
      {
        spaceId: "Spaces-1",
        projectId: "Projects-123",
        Skip: 30,
        Take: 30,
        PartialName: "checkout",
        Tags: ["release-rings/beta", "team/payments"],
        Environments: ["Environments-7", "Environments-8"],
      },
    );
  });

  it("translates a 404 from the listing endpoint into the disabled-capability hint", async () => {
    get.mockRejectedValueOnce(new Error("Not found (404)"));

    await expect(
      findFeatureTogglesHandler({
        spaceName: "Default",
        projectId: "Projects-123",
      }),
    ).rejects.toThrow(/customer feature toggles capability is disabled/);
  });

  it("propagates pagination metadata from the server response", async () => {
    get.mockResolvedValueOnce({
      TotalResults: 47,
      ItemsPerPage: 30,
      NumberOfPages: 2,
      LastPageNumber: 1,
      Items: [makeToggle({ id: 1 }), makeToggle({ id: 2 })],
    });

    const response = await findFeatureTogglesHandler({
      spaceName: "Default",
      projectId: "Projects-123",
    });
    const body = parseToolResponse<ListResponse>(response);

    expect(body.totalResults).toBe(47);
    expect(body.itemsPerPage).toBe(30);
    expect(body.numberOfPages).toBe(2);
    expect(body.lastPageNumber).toBe(1);
    expect(body.items).toHaveLength(2);
  });
});
