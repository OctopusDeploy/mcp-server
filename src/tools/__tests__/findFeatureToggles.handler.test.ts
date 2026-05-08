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

interface ListResponse {
  totalResults: number;
  items: Array<{
    id: string;
    slug: string;
    name: string;
    defaultIsEnabled: boolean;
    rolloutGroupId: string | null;
    environmentSummaries: Array<{
      deploymentEnvironmentId: string;
      isEnabled: boolean;
      rolloutPercentage?: number;
      clientRolloutPercentage?: number;
    }>;
    resourceUri: string;
  }>;
}

const sampleToggle = {
  Id: "FeatureToggles-9",
  SpaceId: "Spaces-1",
  ProjectId: "Projects-123",
  Name: "checkout-redesign",
  Slug: "checkout-redesign",
  DefaultIsEnabled: false,
  Description: "ignored in slim summary",
  Environments: [
    {
      DeploymentEnvironmentId: "Environments-7",
      IsEnabled: true,
      RolloutPercentage: 25,
      ClientRolloutPercentage: 50,
      TenantIds: ["Tenants-42"],
      Segments: [{ Key: "browser", Value: "Chrome" }],
    },
  ],
  Tags: ["release-rings/beta"],
  RolloutGroupId: null,
};

describe("findFeatureTogglesHandler", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("maps the wire-format toggle to a slim summary with per-env state and a URL-encoded resourceUri", async () => {
    get.mockResolvedValueOnce({
      TotalResults: 1,
      ItemsPerPage: 30,
      NumberOfPages: 1,
      LastPageNumber: 0,
      Items: [sampleToggle],
    });

    const response = await findFeatureTogglesHandler({
      spaceName: "AI Foundations",
      projectId: "Projects-123",
    });
    const body = parseToolResponse<ListResponse>(response);

    expect(body.totalResults).toBe(1);
    expect(body.items[0].environmentSummaries).toEqual([
      {
        deploymentEnvironmentId: "Environments-7",
        isEnabled: true,
        rolloutPercentage: 25,
        clientRolloutPercentage: 50,
      },
    ]);
    // Heavy fields (TenantIds, Segments, Description) intentionally absent
    // from the slim summary — they live in the resource body.
    expect(body.items[0].resourceUri).toBe(
      "octopus://spaces/AI%20Foundations/projects/Projects-123/featuretoggles/checkout-redesign",
    );
  });

  it("forwards filter args to the URI template under the exact PascalCase names the server expects", async () => {
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
      tags: ["release-rings/beta"],
      environmentIds: ["Environments-7"],
      skip: 30,
      take: 30,
    });

    expect(get).toHaveBeenCalledWith(
      "~/api/{spaceId}/projects/{projectId}/featuretoggles{?Skip,Take,PartialName,Tags,Environments}",
      {
        spaceId: "Spaces-1",
        projectId: "Projects-123",
        Skip: 30,
        Take: 30,
        PartialName: "checkout",
        Tags: ["release-rings/beta"],
        Environments: ["Environments-7"],
      },
    );
  });

  it("translates a 404 from the listing endpoint into the disabled-capability hint, not a generic space-not-found", async () => {
    // The space resolved fine; the 404 here means either the projectId is
    // wrong or the customer feature toggles capability is off on this
    // instance. The default handleOctopusApiError path would say "Space not
    // found" — wrong message.
    get.mockRejectedValueOnce(new Error("Not found (404)"));

    await expect(
      findFeatureTogglesHandler({
        spaceName: "Default",
        projectId: "Projects-123",
      }),
    ).rejects.toThrow(/customer feature toggles capability is disabled/);
  });
});
