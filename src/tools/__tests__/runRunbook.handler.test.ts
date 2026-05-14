import { describe, it, expect, beforeEach, vi } from "vitest";

const projectList = vi.fn();
const runbookRunCreate = vi.fn();
const runbookRunCreateGit = vi.fn();

vi.mock("../../helpers/getClientConfigurationFromEnvironment.js", () => ({
  getClientConfigurationFromEnvironment: () => ({
    instanceURL: "https://octopus.example",
    apiKey: "API-TEST",
  }),
}));

vi.mock("@octopusdeploy/api-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@octopusdeploy/api-client")>();
  // Arrow functions cannot be invoked with `new`; use regular function
  // expressions so the production code's `new ProjectRepository(...)` works.
  return {
    ...actual,
    Client: { create: vi.fn(async () => ({})) },
    ProjectRepository: function () {
      return { list: projectList };
    },
    RunbookRunRepository: function () {
      return {
        create: runbookRunCreate,
        createGit: runbookRunCreateGit,
      };
    },
  };
});

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runRunbookHandler, runRunbookSchema } from "../runRunbook.js";
import { assertToolResponse, parseToolResponse } from "./testSetup.js";

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

const dbProject = {
  Id: "Projects-1",
  Name: "DbProj",
  Slug: "db-proj",
  IsVersionControlled: false,
  PersistenceSettings: { Type: "Database" as const },
};

const cacProject = {
  Id: "Projects-2",
  Name: "CaCProj",
  Slug: "cac-proj",
  IsVersionControlled: true,
  PersistenceSettings: {
    Type: "VersionControlled" as const,
    Url: "https://github.com/example/cac.git",
    DefaultBranch: "main",
    BasePath: ".octopus",
    Credentials: { Type: "Anonymous" },
    ConversionState: { RunbooksAreInGit: true },
  },
};

function mockProject(project: typeof dbProject | typeof cacProject) {
  projectList.mockResolvedValueOnce({ Items: [project] });
}

const sampleTaskResponse = {
  RunbookRunServerTasks: [
    { ServerTaskId: "ServerTasks-1", RunbookRunId: "RunbookRuns-1" },
  ],
};

describe("runRunbookHandler", () => {
  beforeEach(() => {
    projectList.mockReset();
    runbookRunCreate.mockReset();
    runbookRunCreateGit.mockReset();
  });

  it("DB project without snapshot uses create() and does NOT mention gitRef in the success response", async () => {
    mockProject(dbProject);
    runbookRunCreate.mockResolvedValueOnce(sampleTaskResponse);

    const response = await runRunbookHandler(makeServer(), {
      spaceName: "Default",
      projectName: "DbProj",
      runbookName: "Smoke Test",
      environmentNames: ["Development"],
    });

    expect(runbookRunCreate).toHaveBeenCalledTimes(1);
    expect(runbookRunCreateGit).not.toHaveBeenCalled();
    const [command] = runbookRunCreate.mock.calls[0];
    expect(command).not.toHaveProperty("Snapshot");
    expect(command.RunbookName).toBe("Smoke Test");

    const body = parseToolResponse<{ success: boolean; gitRef?: string }>(
      response,
    );
    expect(body.success).toBe(true);
    expect(body.gitRef).toBeUndefined();
  });

  it("DB project with runbookSnapshotId passes Snapshot through to create()", async () => {
    mockProject(dbProject);
    runbookRunCreate.mockResolvedValueOnce(sampleTaskResponse);

    await runRunbookHandler(makeServer(), {
      spaceName: "Default",
      projectName: "DbProj",
      runbookName: "Smoke Test",
      environmentNames: ["Development"],
      runbookSnapshotId: "RunbookSnapshots-9",
    });

    expect(runbookRunCreate).toHaveBeenCalledTimes(1);
    const [command] = runbookRunCreate.mock.calls[0];
    expect(command.Snapshot).toBe("RunbookSnapshots-9");
  });

  it("CaC project without gitRef returns an error mentioning DefaultBranch and never calls create/createGit", async () => {
    mockProject(cacProject);

    const response = await runRunbookHandler(makeServer(), {
      spaceName: "Default",
      projectName: "CaCProj",
      runbookName: "Provision DB",
      environmentNames: ["Development"],
    });

    const body = parseToolResponse<{ success: boolean; error: string }>(
      response,
    );
    expect(body.success).toBe(false);
    expect(body.error).toContain("stores its runbooks in Git");
    expect(body.error).toContain("'main'");
    expect(runbookRunCreate).not.toHaveBeenCalled();
    expect(runbookRunCreateGit).not.toHaveBeenCalled();
  });

  it("CaC project + gitRef uses createGit(command, gitRef); the command carries no Snapshot field; response echoes gitRef", async () => {
    mockProject(cacProject);
    runbookRunCreateGit.mockResolvedValueOnce(sampleTaskResponse);

    const response = await runRunbookHandler(makeServer(), {
      spaceName: "Default",
      projectName: "CaCProj",
      runbookName: "Provision DB",
      environmentNames: ["Development"],
      gitRef: "main",
    });

    expect(runbookRunCreate).not.toHaveBeenCalled();
    expect(runbookRunCreateGit).toHaveBeenCalledTimes(1);
    const [command, gitRef] = runbookRunCreateGit.mock.calls[0];
    expect(gitRef).toBe("main");
    expect(command).not.toHaveProperty("Snapshot");
    expect(command.RunbookName).toBe("Provision DB");

    const body = parseToolResponse<{ success: boolean; gitRef?: string }>(
      response,
    );
    expect(body.success).toBe(true);
    expect(body.gitRef).toBe("main");
  });

  it("DB project + gitRef is rejected before either API method is called", async () => {
    mockProject(dbProject);

    const response = await runRunbookHandler(makeServer(), {
      spaceName: "Default",
      projectName: "DbProj",
      runbookName: "Smoke Test",
      environmentNames: ["Development"],
      gitRef: "main",
    });

    const body = parseToolResponse<{ success: boolean; error: string }>(
      response,
    );
    expect(body.success).toBe(false);
    expect(body.error).toContain("stores its runbooks in the database");
    expect(runbookRunCreate).not.toHaveBeenCalled();
    expect(runbookRunCreateGit).not.toHaveBeenCalled();
  });

  it("declined elicitation does not issue any run (no create / createGit call)", async () => {
    mockProject(cacProject);

    const response = await runRunbookHandler(
      makeServer({ elicitResult: { action: "decline" } }),
      {
        spaceName: "Default",
        projectName: "CaCProj",
        runbookName: "Provision DB",
        environmentNames: ["Development"],
        gitRef: "main",
      },
    );

    expect(runbookRunCreate).not.toHaveBeenCalled();
    expect(runbookRunCreateGit).not.toHaveBeenCalled();
    assertToolResponse(response);
    const body = JSON.parse(response.content[0].text);
    expect(body.success).toBe(false);
  });

  describe("schema-level rejections", () => {
    it("rejects gitRef + runbookSnapshotId (the two version-pin mechanisms are mutually exclusive)", () => {
      const result = runRunbookSchema.safeParse({
        spaceName: "Default",
        projectName: "CaCProj",
        runbookName: "Provision DB",
        environmentNames: ["Development"],
        gitRef: "main",
        runbookSnapshotId: "RunbookSnapshots-1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.map((i) => i.message).join("\n"),
        ).toMatch(/runbookSnapshotId cannot be combined with gitRef/);
      }
    });

    it("requires environmentNames to be non-empty (existing rule, unchanged)", () => {
      const result = runRunbookSchema.safeParse({
        spaceName: "Default",
        projectName: "Anything",
        runbookName: "Anything",
        environmentNames: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
