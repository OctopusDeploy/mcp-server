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
import {
  updateFeatureToggleHandler,
  updateFeatureToggleValidationSchema,
} from "../updateFeatureToggle.js";
import { assertToolResponse } from "./testSetup.js";
import { type FeatureToggleResource } from "../../types/featureToggleTypes.js";

function makeServer(opts: {
  elicitResult?: { action: "accept" | "decline" | "cancel" };
} = {}): McpServer {
  return {
    server: {
      elicitInput: vi.fn(async () => opts.elicitResult ?? { action: "accept" }),
      getClientCapabilities: vi.fn(() => ({ elicitation: {} })),
    },
  } as unknown as McpServer;
}

const baseToggle: FeatureToggleResource = {
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
      Segments: [{ Key: "browser", Value: "Chrome" }],
      MinimumVersion: "1.4.0",
    },
    {
      DeploymentEnvironmentId: "Environments-8",
      IsEnabled: false,
      RolloutPercentage: 100,
      ClientRolloutPercentage: 100,
      TenantIds: [],
      Segments: [],
      MinimumVersion: null,
    },
  ],
};

describe("updateFeatureToggleHandler", () => {
  beforeEach(() => {
    get.mockReset();
    doUpdate.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("merges patches into the current toggle: targeted env field changes, unmentioned env fields preserved, unmentioned envs untouched, toggle-level fields applied", async () => {
    get.mockResolvedValueOnce(baseToggle);
    doUpdate.mockResolvedValueOnce(undefined);

    await updateFeatureToggleHandler(makeServer(), {
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      defaultIsEnabled: true,
      environments: [
        {
          deploymentEnvironmentId: "Environments-7",
          rolloutPercentage: 75,
        },
      ],
    });

    expect(doUpdate).toHaveBeenCalledTimes(1);
    const [, body] = doUpdate.mock.calls[0];

    // Toggle-level patch applied
    expect(body.DefaultIsEnabled).toBe(true);
    // Toggle-level fields not in the patch are preserved
    expect(body.Description).toBe("Old description");
    expect(body.Name).toBe("checkout-redesign");
    expect(body.Slug).toBe("checkout-redesign");
    expect(body.Tags).toEqual(["release-rings/beta"]);

    // Env-7: patched field updated, all other fields preserved (the
    // failure mode this guards against is the PUT replacing the whole
    // env body and dropping TenantIds, Segments, MinimumVersion, etc.)
    const env7 = body.Environments.find(
      (e: { DeploymentEnvironmentId: string }) =>
        e.DeploymentEnvironmentId === "Environments-7",
    );
    expect(env7).toMatchObject({
      RolloutPercentage: 75,
      IsEnabled: true,
      ClientRolloutPercentage: 50,
      TenantIds: ["Tenants-42"],
      Segments: [{ Key: "browser", Value: "Chrome" }],
      MinimumVersion: "1.4.0",
    });

    // Env-8: not mentioned in the patch, preserved verbatim
    const env8 = body.Environments.find(
      (e: { DeploymentEnvironmentId: string }) =>
        e.DeploymentEnvironmentId === "Environments-8",
    );
    expect(env8).toEqual(baseToggle.Environments[1]);
  });

  it("rejects a patch targeting an environment that isn't on the toggle, instead of silently adding it", async () => {
    get.mockResolvedValueOnce(baseToggle);

    const response = await updateFeatureToggleHandler(makeServer(), {
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
    expect(doUpdate).not.toHaveBeenCalled();
  });

  it("rejects duplicate deploymentEnvironmentId entries at the schema layer", () => {
    // If the schema permitted duplicates, the merge would apply the first
    // patch while the confirmation diff overwrote earlier entries with later
    // ones — the user could approve one change and a different one would go
    // through. Catch it before it reaches the handler.
    const result = updateFeatureToggleValidationSchema.safeParse({
      spaceName: "Default",
      projectId: "Projects-123",
      slug: "checkout-redesign",
      environments: [
        { deploymentEnvironmentId: "Environments-7", isEnabled: true },
        { deploymentEnvironmentId: "Environments-7", rolloutPercentage: 50 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("\n");
      expect(messages).toMatch(/Duplicate environment entry/);
    }
  });

  it("does not issue the PUT when the user declines the elicitation prompt", async () => {
    // The full matrix of confirmation outcomes (envSkip / accepted /
    // fallbackConfirm / cancelled / confirmationRequired) is exercised in
    // requireConfirmation.test.ts. Here we only verify the integration —
    // a "no" answer from the user must not result in a server-side write.
    get.mockResolvedValueOnce(baseToggle);

    const response = await updateFeatureToggleHandler(
      makeServer({ elicitResult: { action: "decline" } }),
      {
        spaceName: "Default",
        projectId: "Projects-123",
        slug: "checkout-redesign",
        defaultIsEnabled: true,
      },
    );

    expect(doUpdate).not.toHaveBeenCalled();
    assertToolResponse(response);
    const body = JSON.parse(response.content[0].text);
    expect(body.success).toBe(false);
    expect(body.cancelled).toBe(true);
  });
});
