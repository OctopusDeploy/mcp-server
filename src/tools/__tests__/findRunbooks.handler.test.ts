import { describe, it, expect, beforeEach, vi } from "vitest";

const projectList = vi.fn();
const runbookGet = vi.fn();
const runbookList = vi.fn();
const runbookGetWithGitRef = vi.fn();
const clientGet = vi.fn();
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
  // Arrow functions cannot be invoked with `new`; use regular function
  // expressions so the production code's `new ProjectRepository(...)` works.
  return {
    ...actual,
    Client: { create: vi.fn(async () => ({ get: clientGet })) },
    resolveSpaceId: (...args: unknown[]) => resolveSpaceId(...args),
    ProjectRepository: function () {
      return { list: projectList };
    },
    RunbookRepository: function () {
      return {
        get: runbookGet,
        list: runbookList,
        getWithGitRef: runbookGetWithGitRef,
      };
    },
  };
});

import {
  findRunbooksHandler,
  findRunbooksValidationSchema,
} from "../findRunbooks.js";
import { parseToolResponse } from "./testSetup.js";

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

const sampleDbRunbook = {
  Id: "Runbooks-7",
  Name: "Smoke Test",
  Description: "Quick smoke",
  ProjectId: "Projects-1",
  RunbookProcessId: "RunbookProcess-Runbooks-7",
  PublishedRunbookSnapshotId: "RunbookSnapshots-1",
  MultiTenancyMode: "Untenanted",
  EnvironmentScope: "All",
  Environments: [],
};

const sampleCacRunbook = {
  Id: "Runbooks-8",
  Name: "Provision DB",
  Description: "Spin up DB",
  ProjectId: "Projects-2",
  RunbookProcessId: "RunbookProcess-Runbooks-8",
  // CaC wire response — Slug is present even though api-client's Runbook type
  // doesn't declare it.
  Slug: "provision-db",
  PublishedRunbookSnapshotId: null,
  MultiTenancyMode: "Untenanted",
  EnvironmentScope: "All",
  Environments: [],
};

function mockProject(project: typeof dbProject | typeof cacProject) {
  projectList.mockResolvedValueOnce({ Items: [project] });
}

describe("findRunbooksHandler", () => {
  beforeEach(() => {
    projectList.mockReset();
    runbookGet.mockReset();
    runbookList.mockReset();
    runbookGetWithGitRef.mockReset();
    clientGet.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("DB project listing returns the legacy summary shape with publishedRunbookSnapshotId and the DB resourceUri", async () => {
    mockProject(dbProject);
    runbookList.mockResolvedValueOnce({
      TotalResults: 1,
      ItemsPerPage: 30,
      NumberOfPages: 1,
      LastPageNumber: 0,
      Items: [sampleDbRunbook],
    });

    const response = await findRunbooksHandler({
      spaceName: "Default",
      projectName: "DbProj",
    });

    const body = parseToolResponse<{
      items: Array<{
        publishedRunbookSnapshotId?: string;
        gitRef?: string;
        resourceUri: string;
      }>;
    }>(response);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].publishedRunbookSnapshotId).toBe("RunbookSnapshots-1");
    expect(body.items[0].gitRef).toBeUndefined();
    expect(body.items[0].resourceUri).toBe(
      "octopus://spaces/Default/runbooks/Runbooks-7",
    );
    expect(runbookGetWithGitRef).not.toHaveBeenCalled();
    expect(clientGet).not.toHaveBeenCalled();
  });

  it("DB project + runbookId returns the legacy single-fetch shape", async () => {
    mockProject(dbProject);
    runbookGet.mockResolvedValueOnce(sampleDbRunbook);

    const response = await findRunbooksHandler({
      spaceName: "Default",
      projectName: "DbProj",
      runbookId: "Runbooks-7",
    });

    const body = parseToolResponse<{
      publishedRunbookSnapshotId?: string;
      resourceUri: string;
    }>(response);
    expect(body.publishedRunbookSnapshotId).toBe("RunbookSnapshots-1");
    expect(body.resourceUri).toBe(
      "octopus://spaces/Default/runbooks/Runbooks-7",
    );
    expect(runbookGet).toHaveBeenCalledWith("Runbooks-7");
  });

  it("CaC project without gitRef returns an error mentioning DefaultBranch and get_branches without calling the runbook API", async () => {
    mockProject(cacProject);

    const response = await findRunbooksHandler({
      spaceName: "Default",
      projectName: "CaCProj",
    });

    const body = parseToolResponse<{ success: boolean; error: string }>(
      response,
    );
    expect(body.success).toBe(false);
    expect(body.error).toContain("stores its runbooks in Git");
    expect(body.error).toContain("'main'");
    expect(body.error).toContain("get_branches");
    expect(runbookList).not.toHaveBeenCalled();
    expect(runbookGetWithGitRef).not.toHaveBeenCalled();
    expect(clientGet).not.toHaveBeenCalled();
  });

  it("CaC project + gitRef listing hits the git URL and returns CaC summaries with gitRef and CaC resourceUri (no publishedRunbookSnapshotId)", async () => {
    mockProject(cacProject);
    clientGet.mockResolvedValueOnce({
      TotalResults: 1,
      ItemsPerPage: 30,
      NumberOfPages: 1,
      LastPageNumber: 0,
      Items: [sampleCacRunbook],
    });

    const response = await findRunbooksHandler({
      spaceName: "Default",
      projectName: "CaCProj",
      gitRef: "main",
    });

    expect(clientGet).toHaveBeenCalledTimes(1);
    const [url, vars] = clientGet.mock.calls[0];
    expect(url).toContain("/projects/{projectId}/{gitRef}/runbooks");
    expect(vars).toMatchObject({
      spaceId: "Spaces-1",
      projectId: "Projects-2",
      gitRef: "main",
    });

    const body = parseToolResponse<{
      items: Array<{
        gitRef: string;
        publishedRunbookSnapshotId?: string;
        resourceUri?: string;
      }>;
    }>(response);
    expect(body.items[0].gitRef).toBe("main");
    expect(body.items[0].publishedRunbookSnapshotId).toBeUndefined();
    expect(body.items[0].resourceUri).toBe(
      "octopus://spaces/Default/projects/cac-proj/main/runbooks/provision-db",
    );
  });

  it("CaC project + gitRef + runbookSlug calls getWithGitRef(slug, gitRef) and returns the single-fetch CaC summary", async () => {
    mockProject(cacProject);
    runbookGetWithGitRef.mockResolvedValueOnce(sampleCacRunbook);

    const response = await findRunbooksHandler({
      spaceName: "Default",
      projectName: "CaCProj",
      gitRef: "main",
      runbookSlug: "provision-db",
    });

    expect(runbookGetWithGitRef).toHaveBeenCalledWith("provision-db", "main");
    const body = parseToolResponse<{ gitRef: string; resourceUri: string }>(
      response,
    );
    expect(body.gitRef).toBe("main");
    expect(body.resourceUri).toBe(
      "octopus://spaces/Default/projects/cac-proj/main/runbooks/provision-db",
    );
  });

  it("CaC project + gitRef when the wire response omits Slug falls back to omitting resourceUri instead of fabricating one", async () => {
    mockProject(cacProject);
    const cacRunbookWithoutSlug = { ...sampleCacRunbook };
    delete (cacRunbookWithoutSlug as { Slug?: string }).Slug;
    runbookGetWithGitRef.mockResolvedValueOnce(cacRunbookWithoutSlug);

    const response = await findRunbooksHandler({
      spaceName: "Default",
      projectName: "CaCProj",
      gitRef: "main",
      runbookSlug: "provision-db",
    });

    const body = parseToolResponse<{
      gitRef: string;
      resourceUri?: string;
    }>(response);
    expect(body.gitRef).toBe("main");
    expect(body.resourceUri).toBeUndefined();
  });

  it("DB project + gitRef is rejected before calling the runbook API (mismatched route would otherwise silently misbehave)", async () => {
    mockProject(dbProject);

    const response = await findRunbooksHandler({
      spaceName: "Default",
      projectName: "DbProj",
      gitRef: "main",
    });

    const body = parseToolResponse<{ success: boolean; error: string }>(
      response,
    );
    expect(body.success).toBe(false);
    expect(body.error).toContain("stores its runbooks in the database");
    expect(runbookList).not.toHaveBeenCalled();
    expect(clientGet).not.toHaveBeenCalled();
  });

  describe("schema-level rejections", () => {
    it("rejects runbookId + gitRef (a runbook ID belongs to a DB project; gitRef belongs to a CaC project)", () => {
      const result = findRunbooksValidationSchema.safeParse({
        spaceName: "Default",
        projectName: "Anything",
        runbookId: "Runbooks-1",
        gitRef: "main",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.map((i) => i.message).join("\n"),
        ).toMatch(/gitRef cannot be combined with runbookId/);
      }
    });

    it("rejects runbookSlug without gitRef (CaC slugs aren't unique without a ref)", () => {
      const result = findRunbooksValidationSchema.safeParse({
        spaceName: "Default",
        projectName: "Anything",
        runbookSlug: "provision-db",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.map((i) => i.message).join("\n"),
        ).toMatch(/runbookSlug requires gitRef/);
      }
    });

    it("rejects runbookId + runbookSlug (the two ID forms are mutually exclusive)", () => {
      const result = findRunbooksValidationSchema.safeParse({
        spaceName: "Default",
        projectName: "Anything",
        runbookId: "Runbooks-1",
        runbookSlug: "provision-db",
        gitRef: "main",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.map((i) => i.message).join("\n"),
        ).toMatch(/mutually exclusive/);
      }
    });

    it("still rejects runbookId + partialName (existing rule, unchanged)", () => {
      const result = findRunbooksValidationSchema.safeParse({
        spaceName: "Default",
        projectName: "Anything",
        runbookId: "Runbooks-1",
        partialName: "smoke",
      });
      expect(result.success).toBe(false);
    });
  });
});
