import { describe, it, expect, beforeEach, vi } from "vitest";

const get = vi.fn();
const doUpdate = vi.fn();
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
    Client: { create: vi.fn(async () => ({ get, doUpdate })) },
    resolveSpaceId: (...args: unknown[]) => resolveSpaceId(...args),
  };
});

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateFeatureToggleHandler } from "../updateFeatureToggle.js";
import { parseToolResponse, assertToolResponse } from "./testSetup.js";
import { type FeatureToggleResource } from "../../types/featureToggleTypes.js";

interface ServerStub {
  server: McpServer;
  elicitInput: ReturnType<typeof vi.fn>;
  getClientCapabilities: ReturnType<typeof vi.fn>;
}

function makeServerStub(opts: {
  elicitation?: boolean;
  elicitResult?: { action: "accept" | "decline" | "cancel" };
}): ServerStub {
  const elicitInput = vi.fn(async () => opts.elicitResult ?? { action: "accept" });
  const getClientCapabilities = vi.fn(() =>
    opts.elicitation ? { elicitation: {} } : {},
  );
  const server = {
    server: {
      elicitInput,
      getClientCapabilities,
    },
  } as unknown as McpServer;
  return { server, elicitInput, getClientCapabilities };
}

function makeToggle(
  overrides: Partial<FeatureToggleResource> = {},
): FeatureToggleResource {
  return {
    Id: "FeatureToggles-9",
    SpaceId: "Spaces-1",
    ProjectId: "Projects-123",
    Name: "checkout-redesign",
    Slug: "checkout-redesign",
    DefaultIsEnabled: false,
    Description: "Old description",
    Tags: ["release-rings/beta"],
    RolloutGroupId: null,
    Environments: [
      {
        DeploymentEnvironmentId: "Environments-7",
        IsEnabled: true,
        RolloutPercentage: 25,
        ClientRolloutPercentage: 50,
        TenantIds: ["Tenants-42"],
        ExcludedTenantIds: [],
        TenantTags: [],
        ExcludedTenantTags: [],
        Segments: [{ Key: "browser", Value: "Chrome" }],
        MinimumVersion: "1.4.0",
      },
      {
        DeploymentEnvironmentId: "Environments-8",
        IsEnabled: false,
        RolloutPercentage: 100,
        ClientRolloutPercentage: 100,
        TenantIds: [],
        ExcludedTenantIds: [],
        TenantTags: [],
        ExcludedTenantTags: [],
        Segments: [],
        MinimumVersion: null,
      },
    ],
    ...overrides,
  };
}

describe("updateFeatureToggleHandler", () => {
  beforeEach(() => {
    get.mockReset();
    doUpdate.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("rejects calls with no patches", async () => {
    const { server } = makeServerStub({ elicitation: true });

    const response = await updateFeatureToggleHandler(server, {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
    });

    assertToolResponse(response);
    expect(response.isError).toBe(true);
    const body = JSON.parse(response.content[0].text);
    expect(body.reason).toBe("no_patches");
    expect(get).not.toHaveBeenCalled();
    expect(doUpdate).not.toHaveBeenCalled();
  });

  it("rejects a patch targeting an environment that isn't on the toggle", async () => {
    const { server } = makeServerStub({ elicitation: true });
    get.mockResolvedValueOnce(makeToggle());

    const response = await updateFeatureToggleHandler(server, {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      environments: [
        { deploymentEnvironmentId: "Environments-99", isEnabled: true },
      ],
    });

    assertToolResponse(response);
    expect(response.isError).toBe(true);
    const body = JSON.parse(response.content[0].text);
    expect(body.reason).toBe("environment_not_configured");
    expect(body.configuredEnvironmentIds).toEqual([
      "Environments-7",
      "Environments-8",
    ]);
    expect(doUpdate).not.toHaveBeenCalled();
  });

  it("returns noOp when every supplied field already matches current state", async () => {
    const { server } = makeServerStub({ elicitation: true });
    const current = makeToggle();
    get.mockResolvedValueOnce(current);

    const response = await updateFeatureToggleHandler(server, {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      defaultIsEnabled: current.DefaultIsEnabled,
      environments: [
        {
          deploymentEnvironmentId: "Environments-7",
          rolloutPercentage: current.Environments[0].RolloutPercentage,
        },
      ],
    });

    const body = parseToolResponse<{ success: boolean; noOp: boolean }>(response);
    expect(body.success).toBe(true);
    expect(body.noOp).toBe(true);
    expect(doUpdate).not.toHaveBeenCalled();
  });

  it("merges per-environment patches and preserves unmentioned envs and fields", async () => {
    const { server } = makeServerStub({ elicitation: true });
    const current = makeToggle();
    get.mockResolvedValueOnce(current);
    doUpdate.mockResolvedValueOnce(undefined);

    const response = await updateFeatureToggleHandler(server, {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      environments: [
        {
          deploymentEnvironmentId: "Environments-7",
          rolloutPercentage: 75,
        },
      ],
    });

    expect(doUpdate).toHaveBeenCalledTimes(1);
    const [path, body, args] = doUpdate.mock.calls[0];
    expect(path).toBe("~/api/{spaceId}/projects/{projectId}/featuretoggles");
    expect(args).toEqual({ spaceId: "Spaces-1", projectId: "Projects-123" });

    // Envs-7 patched
    const env7 = body.Environments.find(
      (e: { DeploymentEnvironmentId: string }) =>
        e.DeploymentEnvironmentId === "Environments-7",
    );
    expect(env7.RolloutPercentage).toBe(75);
    // Other fields on Envs-7 preserved
    expect(env7.IsEnabled).toBe(true);
    expect(env7.ClientRolloutPercentage).toBe(50);
    expect(env7.TenantIds).toEqual(["Tenants-42"]);
    expect(env7.Segments).toEqual([{ Key: "browser", Value: "Chrome" }]);
    expect(env7.MinimumVersion).toBe("1.4.0");

    // Envs-8 untouched
    const env8 = body.Environments.find(
      (e: { DeploymentEnvironmentId: string }) =>
        e.DeploymentEnvironmentId === "Environments-8",
    );
    expect(env8.RolloutPercentage).toBe(100);
    expect(env8.IsEnabled).toBe(false);

    // Toggle-level fields preserved
    expect(body.Name).toBe("checkout-redesign");
    expect(body.Slug).toBe("checkout-redesign");
    expect(body.Id).toBe("FeatureToggles-9");
    expect(body.DefaultIsEnabled).toBe(false);
    expect(body.Description).toBe("Old description");
    expect(body.Tags).toEqual(["release-rings/beta"]);

    // Success response
    const respBody = parseToolResponse<{ success: boolean; resourceUri: string }>(
      response,
    );
    expect(respBody.success).toBe(true);
    expect(respBody.resourceUri).toBe(
      "octopus://spaces/Default/projects/Projects-123/featuretoggles/checkout-redesign",
    );
  });

  it("applies toggle-level patches (defaultIsEnabled, description) without touching environments", async () => {
    const { server } = makeServerStub({ elicitation: true });
    const current = makeToggle();
    get.mockResolvedValueOnce(current);
    doUpdate.mockResolvedValueOnce(undefined);

    await updateFeatureToggleHandler(server, {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      defaultIsEnabled: true,
      description: "Updated description",
    });

    const [, body] = doUpdate.mock.calls[0];
    expect(body.DefaultIsEnabled).toBe(true);
    expect(body.Description).toBe("Updated description");
    // Environments untouched
    expect(body.Environments).toEqual(current.Environments);
  });

  it("aborts when the user declines elicitation", async () => {
    const { server, elicitInput } = makeServerStub({
      elicitation: true,
      elicitResult: { action: "decline" },
    });
    get.mockResolvedValueOnce(makeToggle());

    const response = await updateFeatureToggleHandler(server, {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      defaultIsEnabled: true,
    });

    expect(elicitInput).toHaveBeenCalledTimes(1);
    expect(doUpdate).not.toHaveBeenCalled();
    const body = parseToolResponse<{ success: boolean; cancelled: boolean }>(
      response,
    );
    expect(body.success).toBe(false);
    expect(body.cancelled).toBe(true);
  });

  it("returns confirmationRequired when client lacks elicitation and confirm is omitted", async () => {
    const { server } = makeServerStub({ elicitation: false });
    get.mockResolvedValueOnce(makeToggle());

    const response = await updateFeatureToggleHandler(server, {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      defaultIsEnabled: true,
    });

    assertToolResponse(response);
    expect(response.isError).toBe(true);
    const body = JSON.parse(response.content[0].text);
    expect(body.confirmationRequired).toBe(true);
    expect(doUpdate).not.toHaveBeenCalled();
  });

  it("proceeds without elicitation when confirm: true is supplied as fallback", async () => {
    const { server, elicitInput } = makeServerStub({ elicitation: false });
    get.mockResolvedValueOnce(makeToggle());
    doUpdate.mockResolvedValueOnce(undefined);

    const response = await updateFeatureToggleHandler(server, {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      defaultIsEnabled: true,
      confirm: true,
    });

    expect(elicitInput).not.toHaveBeenCalled();
    expect(doUpdate).toHaveBeenCalledTimes(1);
    const body = parseToolResponse<{ success: boolean }>(response);
    expect(body.success).toBe(true);
  });

  it("translates a 404 from the GET into the disabled-capability hint", async () => {
    const { server } = makeServerStub({ elicitation: true });
    get.mockRejectedValueOnce(new Error("Not found (404)"));

    await expect(
      updateFeatureToggleHandler(server, {
        spaceName: "Default",
        projectId: "Projects-123",
        slug: "missing",
        defaultIsEnabled: true,
      }),
    ).rejects.toThrow(/not found in space 'Default'/);
  });
});
