import { describe, it, expect, beforeEach, vi } from "vitest";

const dispatchRequest = vi.fn();
const resolveUrl = vi.fn(
  (path: string) => `https://octopus.example${path}`,
);
const elicitInput = vi.fn();
const getClientCapabilities = vi.fn();

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
    Client: {
      create: vi.fn(async () => ({ resolveUrl, dispatchRequest })),
    },
  };
});

import { registerExecuteTool } from "../execute.js";
import { setActiveToolsetConfig } from "../../helpers/activeToolsetConfig.js";

interface RegisteredTool {
  config: {
    title?: string;
    description?: string;
    annotations?: unknown;
  };
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

interface ServerStub {
  registerTool: (
    name: string,
    config: RegisteredTool["config"],
    handler: RegisteredTool["handler"],
  ) => void;
  server: {
    getClientCapabilities: typeof getClientCapabilities;
    elicitInput: typeof elicitInput;
  };
}

function makeServerStub(): {
  server: ServerStub;
  registered: Map<string, RegisteredTool>;
} {
  const registered = new Map<string, RegisteredTool>();
  return {
    server: {
      registerTool(name, config, handler) {
        registered.set(name, { config, handler });
      },
      server: { getClientCapabilities, elicitInput },
    },
    registered,
  };
}

function getHandler(): RegisteredTool["handler"] {
  const { server, registered } = makeServerStub();
  registerExecuteTool(server as never);
  return registered.get("execute")!.handler;
}

function parseResponse(response: { content: Array<{ text: string }> }): {
  success?: boolean;
  reason?: string;
  message?: string;
  response?: unknown;
} {
  return JSON.parse(response.content[0].text);
}

describe("execute tool — read tier (GET)", () => {
  beforeEach(() => {
    dispatchRequest.mockReset();
    resolveUrl.mockClear();
    getClientCapabilities.mockReset();
    elicitInput.mockReset();
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: true,
      allowDeletes: false,
    });
  });

  it("allows GET in read-only mode without elicitation", async () => {
    dispatchRequest.mockResolvedValue({ Items: [{ Name: "Default" }] });
    const handler = getHandler();

    const response = await handler({ method: "GET", path: "/api/spaces" });
    const body = parseResponse(response);

    expect(body.success).toBe(true);
    expect(dispatchRequest).toHaveBeenCalledWith(
      "GET",
      "https://octopus.example/api/spaces",
      null,
    );
    expect(elicitInput).not.toHaveBeenCalled();
  });
});

describe("execute tool — write tier (POST/PUT/PATCH)", () => {
  beforeEach(() => {
    dispatchRequest.mockReset();
    resolveUrl.mockClear();
    getClientCapabilities.mockReset();
    elicitInput.mockReset();
  });

  it("blocks POST in read-only mode with the readOnlyMode reason", async () => {
    setActiveToolsetConfig({ enabledToolsets: "all", readOnlyMode: true });
    const handler = getHandler();

    const response = await handler({
      method: "POST",
      path: "/api/Spaces-1/projects",
      body: { Name: "X" },
    });

    expect(response.isError).toBe(true);
    expect(parseResponse(response).reason).toBe("readOnlyMode");
    expect(dispatchRequest).not.toHaveBeenCalled();
  });

  it("requests elicitation for POST in write mode and proceeds on accept", async () => {
    setActiveToolsetConfig({ enabledToolsets: "all", readOnlyMode: false });
    getClientCapabilities.mockReturnValue({ elicitation: {} });
    elicitInput.mockResolvedValue({ action: "accept" });
    dispatchRequest.mockResolvedValue({ Id: "Projects-99" });
    const handler = getHandler();

    const response = await handler({
      method: "POST",
      path: "/api/Spaces-1/projects",
      body: { Name: "X" },
    });

    expect(elicitInput).toHaveBeenCalledOnce();
    const elicMessage = elicitInput.mock.calls[0][0].message as string;
    expect(elicMessage).toContain("POST /api/Spaces-1/projects");
    expect(elicMessage).not.toContain("IRREVERSIBLE");
    expect(parseResponse(response).success).toBe(true);
  });

  it("aborts POST when the user declines the elicitation", async () => {
    setActiveToolsetConfig({ enabledToolsets: "all", readOnlyMode: false });
    getClientCapabilities.mockReturnValue({ elicitation: {} });
    elicitInput.mockResolvedValue({ action: "decline" });
    const handler = getHandler();

    const response = await handler({
      method: "POST",
      path: "/api/Spaces-1/projects",
      body: { Name: "X" },
    });

    expect(dispatchRequest).not.toHaveBeenCalled();
    expect(parseResponse(response).message).toMatch(/cancelled/i);
  });

  it("PATCH passes through the same write gate", async () => {
    setActiveToolsetConfig({ enabledToolsets: "all", readOnlyMode: true });
    const handler = getHandler();

    const response = await handler({
      method: "PATCH",
      path: "/api/Spaces-1/projects/Projects-1",
      body: {},
    });

    expect(response.isError).toBe(true);
    expect(parseResponse(response).reason).toBe("readOnlyMode");
  });
});

describe("execute tool — delete tier (DELETE)", () => {
  beforeEach(() => {
    dispatchRequest.mockReset();
    resolveUrl.mockClear();
    getClientCapabilities.mockReset();
    elicitInput.mockReset();
  });

  it("blocks DELETE in read-only mode (mentions both flags)", async () => {
    setActiveToolsetConfig({ enabledToolsets: "all", readOnlyMode: true });
    const handler = getHandler();

    const response = await handler({
      method: "DELETE",
      path: "/api/Spaces-1/runbookruns/RunbookRuns-1",
    });

    expect(response.isError).toBe(true);
    const body = parseResponse(response);
    expect(body.reason).toBe("readOnlyMode");
    expect(body.message).toContain("--allow-deletes");
  });

  it("blocks DELETE when --allow-deletes is not set", async () => {
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
      allowDeletes: false,
    });
    const handler = getHandler();

    const response = await handler({
      method: "DELETE",
      path: "/api/Spaces-1/runbookruns/RunbookRuns-1",
    });

    expect(response.isError).toBe(true);
    expect(parseResponse(response).reason).toBe("deletesNotAllowed");
    expect(dispatchRequest).not.toHaveBeenCalled();
  });

  it("permits DELETE only when both flags are set, with a stronger elicitation message", async () => {
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
      allowDeletes: true,
    });
    getClientCapabilities.mockReturnValue({ elicitation: {} });
    elicitInput.mockResolvedValue({ action: "accept" });
    dispatchRequest.mockResolvedValue({});
    const handler = getHandler();

    const response = await handler({
      method: "DELETE",
      path: "/api/Spaces-1/runbookruns/RunbookRuns-1",
    });

    expect(elicitInput).toHaveBeenCalledOnce();
    const elicMessage = elicitInput.mock.calls[0][0].message as string;
    expect(elicMessage).toContain("IRREVERSIBLE");
    expect(parseResponse(response).success).toBe(true);
  });

  it("blocks catastrophic DELETEs even with both flags set (sensitive denylist)", async () => {
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
      allowDeletes: true,
    });
    getClientCapabilities.mockReturnValue({ elicitation: {} });
    const handler = getHandler();

    const spaceDelete = await handler({
      method: "DELETE",
      path: "/api/spaces/Spaces-1",
    });
    expect(spaceDelete.isError).toBe(true);
    expect(parseResponse(spaceDelete).reason).toBe("sensitivePath");

    const userDelete = await handler({
      method: "DELETE",
      path: "/api/users/Users-1",
    });
    expect(userDelete.isError).toBe(true);
    expect(parseResponse(userDelete).reason).toBe("sensitivePath");

    expect(dispatchRequest).not.toHaveBeenCalled();
    expect(elicitInput).not.toHaveBeenCalled();
  });
});

describe("execute tool — sensitive denylist (always-on)", () => {
  beforeEach(() => {
    dispatchRequest.mockReset();
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
      allowDeletes: true,
    });
  });

  it("blocks API key endpoints regardless of method", async () => {
    const handler = getHandler();

    const get = await handler({
      method: "GET",
      path: "/api/users/me/apikeys",
    });
    expect(get.isError).toBe(true);
    expect(parseResponse(get).reason).toBe("sensitivePath");

    const post = await handler({
      method: "POST",
      path: "/api/users/Users-1/apikeys",
      body: {},
    });
    expect(post.isError).toBe(true);
    expect(parseResponse(post).reason).toBe("sensitivePath");

    expect(dispatchRequest).not.toHaveBeenCalled();
  });
});

describe("execute tool — path allowlist by toolset", () => {
  beforeEach(() => {
    dispatchRequest.mockReset();
    elicitInput.mockReset();
    getClientCapabilities.mockReturnValue({ elicitation: {} });
    elicitInput.mockResolvedValue({ action: "accept" });
  });

  it("blocks paths whose owning toolset is not enabled, naming the toolset", async () => {
    setActiveToolsetConfig({
      enabledToolsets: ["projects"],
      readOnlyMode: true,
    });
    const handler = getHandler();

    const response = await handler({
      method: "GET",
      path: "/api/Spaces-1/certificates",
    });

    expect(response.isError).toBe(true);
    const body = parseResponse(response);
    expect(body.reason).toBe("pathNotAllowed");
    expect(body.message).toContain("certificates");
    expect(dispatchRequest).not.toHaveBeenCalled();
  });

  it("permits paths owned by an enabled toolset", async () => {
    setActiveToolsetConfig({
      enabledToolsets: ["projects"],
      readOnlyMode: true,
    });
    dispatchRequest.mockResolvedValue({});
    const handler = getHandler();

    const response = await handler({
      method: "GET",
      path: "/api/Spaces-1/projects",
    });

    expect(parseResponse(response).success).toBe(true);
  });

  it("core paths are reachable with no toolsets enabled", async () => {
    setActiveToolsetConfig({
      enabledToolsets: [],
      readOnlyMode: true,
    });
    dispatchRequest.mockResolvedValue({});
    const handler = getHandler();

    const response = await handler({ method: "GET", path: "/api/spaces" });

    expect(parseResponse(response).success).toBe(true);
  });

  it("bypasses the allowlist when all toolsets are enabled, even for paths with no owning toolset", async () => {
    // The allowlist's only job is the kill-switch when toolsets are narrowed.
    // When everything is enabled there is no scope to enforce, so paths that
    // happen to be missing from TOOLSET_PATH_PATTERNS (e.g. /feeds) must still
    // be reachable — otherwise the allowlist degenerates into a stale
    // hand-rolled enumeration that contradicts grep_llms_txt-driven discovery.
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
    });
    dispatchRequest.mockResolvedValue({ Id: "Feeds-99" });
    const handler = getHandler();

    const response = await handler({
      method: "POST",
      path: "/api/Spaces-1/feeds",
      body: { Name: "MyFeed", FeedType: "Nuget" },
    });

    expect(parseResponse(response).success).toBe(true);
    expect(dispatchRequest).toHaveBeenCalledWith(
      "POST",
      "https://octopus.example/api/Spaces-1/feeds",
      { Name: "MyFeed", FeedType: "Nuget" },
    );
  });

  it("blocks non-/api paths even when all toolsets are enabled (scope boundary)", async () => {
    // Counterpart to the bypass test above: bypassing the allowlist must not
    // turn execute into a general server-relative request tool. The /api
    // prefix check in validateExecutePath is the boundary.
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
    });
    const handler = getHandler();

    const response = await handler({
      method: "GET",
      path: "/octopus/portal",
    });

    expect(response.isError).toBe(true);
    expect(parseResponse(response).reason).toBe("invalidPath");
    expect(dispatchRequest).not.toHaveBeenCalled();
  });

  it("still blocks paths with no owning toolset when toolsets are narrowed", async () => {
    // Counterpart to the bypass test above: when the user has explicitly
    // narrowed toolsets, the allowlist applies and unknown paths stay blocked.
    setActiveToolsetConfig({
      enabledToolsets: ["projects"],
      readOnlyMode: false,
    });
    const handler = getHandler();

    const response = await handler({
      method: "POST",
      path: "/api/Spaces-1/feeds",
      body: { Name: "MyFeed" },
    });

    expect(response.isError).toBe(true);
    expect(parseResponse(response).reason).toBe("pathNotAllowed");
    expect(dispatchRequest).not.toHaveBeenCalled();
  });
});

describe("execute tool — path validation (Gate 0)", () => {
  beforeEach(() => {
    dispatchRequest.mockReset();
    elicitInput.mockReset();
    setActiveToolsetConfig({
      enabledToolsets: "all",
      readOnlyMode: false,
      allowDeletes: true,
    });
  });

  it("rejects '..' traversal even when later gates would have allowed the canonical path", async () => {
    // Codex-flagged bypass: this path passes the legacy /api/spaces/** core
    // pattern but resolves to /api/users/me/apikeys server-side. Gate 0 must
    // reject before sensitive denylist or allowlist run.
    const handler = getHandler();
    const response = await handler({
      method: "GET",
      path: "/api/spaces/Spaces-1/../../users/me/apikeys",
    });
    expect(response.isError).toBe(true);
    expect(parseResponse(response).reason).toBe("invalidPath");
    expect(dispatchRequest).not.toHaveBeenCalled();
  });

  it("rejects backslashes, query strings, fragments, and percent-encoded slashes", async () => {
    const handler = getHandler();

    for (const path of [
      "/api/spaces\\..\\users",
      "/api/spaces?take=10",
      "/api/spaces#frag",
      "/api/users%2Fme%2Fapikeys",
    ]) {
      const response = await handler({ method: "GET", path });
      expect(response.isError).toBe(true);
      expect(parseResponse(response).reason).toBe("invalidPath");
    }
    expect(dispatchRequest).not.toHaveBeenCalled();
  });
});

describe("execute tool — registration metadata", () => {
  it("registers as DESTRUCTIVE_WRITE so well-behaved clients confirm before run", () => {
    const { server, registered } = makeServerStub();
    registerExecuteTool(server as never);
    const tool = registered.get("execute")!;

    expect(tool.config.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
  });
});
