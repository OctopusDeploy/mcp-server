import { describe, it, expect, beforeEach, vi } from "vitest";

const get = vi.fn();
const getServerInformation = vi.fn();

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
    Client: { create: vi.fn(async () => ({ get, getServerInformation })) },
  };
});

import { buildCapabilities } from "../capabilities.js";
import { setActiveToolsetConfig } from "../../../helpers/activeToolsetConfig.js";
import {
  TOOL_REGISTRY,
  type ToolRegistration,
} from "../../../types/toolConfig.js";

function fakeRegistration(
  toolName: string,
  toolset: ToolRegistration["config"]["toolset"],
  readOnly: boolean,
  minimumOctopusVersion?: string,
): ToolRegistration {
  return {
    toolName,
    config: { toolset, readOnly },
    registerFn: () => {},
    minimumOctopusVersion,
  };
}

describe("octopus://api/capabilities", () => {
  beforeEach(() => {
    get.mockReset();
    getServerInformation.mockReset();
    TOOL_REGISTRY.clear();
    setActiveToolsetConfig({});
  });

  it("composes server info, session config, and the enabled tool list", async () => {
    getServerInformation.mockResolvedValue({
      version: "2026.2.9373",
      installationId: "abc-123",
    });
    get.mockResolvedValue({ MultiTenancy: true, Kubernetes: true });

    TOOL_REGISTRY.set(
      "find_releases",
      fakeRegistration("find_releases", "releases", true, "2024.1"),
    );
    TOOL_REGISTRY.set(
      "list_spaces",
      fakeRegistration("list_spaces", "core", true),
    );
    TOOL_REGISTRY.set(
      "deploy_release",
      fakeRegistration("deploy_release", "releases", false),
    );
    setActiveToolsetConfig({
      enabledToolsets: ["releases"],
      readOnlyMode: false,
    });

    const cap = await buildCapabilities();

    expect(cap.server).toEqual({
      version: "2026.2.9373",
      installationId: "abc-123",
    });
    expect(cap.session.readOnlyMode).toBe(false);
    expect(cap.session.allowDeletes).toBe(false);
    expect(cap.session.enabledToolsets).toContain("releases");
    expect(cap.session.enabledToolsets).toContain("core");
    expect(cap.tools.map((t) => t.name).sort()).toEqual([
      "deploy_release",
      "find_releases",
      "list_spaces",
    ]);
    expect(cap.tools.find((t) => t.name === "find_releases")).toMatchObject({
      toolset: "releases",
      readOnly: true,
      minimumOctopusVersion: "2024.1",
    });
    expect(cap.featureFlags).toEqual({ MultiTenancy: true, Kubernetes: true });
  });

  it("hides write-tier tools when read-only mode is on", async () => {
    getServerInformation.mockResolvedValue({
      version: "2026.2.9373",
      installationId: "abc-123",
    });
    get.mockResolvedValue({});

    TOOL_REGISTRY.set(
      "find_releases",
      fakeRegistration("find_releases", "releases", true),
    );
    TOOL_REGISTRY.set(
      "deploy_release",
      fakeRegistration("deploy_release", "releases", false),
    );
    setActiveToolsetConfig({
      enabledToolsets: ["releases"],
      readOnlyMode: true,
    });

    const cap = await buildCapabilities();

    expect(cap.tools.map((t) => t.name)).toEqual(["find_releases"]);
  });

  it("hides tools whose toolset is not enabled (core is always enabled)", async () => {
    getServerInformation.mockResolvedValue({
      version: "2026.2.9373",
      installationId: "abc-123",
    });
    get.mockResolvedValue({});

    TOOL_REGISTRY.set(
      "list_spaces",
      fakeRegistration("list_spaces", "core", true),
    );
    TOOL_REGISTRY.set(
      "find_certificates",
      fakeRegistration("find_certificates", "certificates", true),
    );
    setActiveToolsetConfig({
      enabledToolsets: ["releases"],
      readOnlyMode: true,
    });

    const cap = await buildCapabilities();

    expect(cap.tools.map((t) => t.name)).toEqual(["list_spaces"]);
    expect(cap.session.enabledToolsets).toContain("core");
    expect(cap.session.enabledToolsets).toContain("releases");
    expect(cap.session.enabledToolsets).not.toContain("certificates");
  });

  it("omits featureFlags when /api/serverstatus/extensions is unavailable", async () => {
    getServerInformation.mockResolvedValue({
      version: "2026.2.9373",
      installationId: "abc-123",
    });
    get.mockRejectedValue(new Error("404 Not Found"));

    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: true,
    });

    const cap = await buildCapabilities();

    expect("featureFlags" in cap).toBe(false);
    expect(cap.server.version).toBe("2026.2.9373");
  });

  it("reflects allowDeletes from the active config", async () => {
    getServerInformation.mockResolvedValue({
      version: "2026.2.9373",
      installationId: "abc-123",
    });
    get.mockResolvedValue({});

    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
      allowDeletes: true,
    });

    const cap = await buildCapabilities();

    expect(cap.session.allowDeletes).toBe(true);
  });

  it("flags execute as methodGated and reports its effective tiers per session", async () => {
    getServerInformation.mockResolvedValue({
      version: "2026.2.9373",
      installationId: "abc-123",
    });
    get.mockResolvedValue({});

    TOOL_REGISTRY.set(
      "execute",
      fakeRegistration("execute", "core", true),
    );
    TOOL_REGISTRY.set(
      "list_spaces",
      fakeRegistration("list_spaces", "core", true),
    );

    // Read-only mode: only the read tier is reachable.
    setActiveToolsetConfig({ enabledToolsets: "all", readOnlyMode: true });
    let cap = await buildCapabilities();
    let executeEntry = cap.tools.find((t) => t.name === "execute")!;
    expect(executeEntry.methodGated).toBe(true);
    expect(executeEntry.tiersAvailable).toEqual(["read"]);

    // Static read-only tools must NOT carry methodGated/tiersAvailable.
    const listEntry = cap.tools.find((t) => t.name === "list_spaces")!;
    expect(listEntry.methodGated).toBeUndefined();
    expect(listEntry.tiersAvailable).toBeUndefined();

    // --no-read-only without --allow-deletes: read + write reachable.
    setActiveToolsetConfig({ enabledToolsets: "all", readOnlyMode: false });
    cap = await buildCapabilities();
    executeEntry = cap.tools.find((t) => t.name === "execute")!;
    expect(executeEntry.tiersAvailable).toEqual(["read", "write"]);

    // Both flags: all three tiers reachable.
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
      allowDeletes: true,
    });
    cap = await buildCapabilities();
    executeEntry = cap.tools.find((t) => t.name === "execute")!;
    expect(executeEntry.tiersAvailable).toEqual(["read", "write", "delete"]);
  });
});
