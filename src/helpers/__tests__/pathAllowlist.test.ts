import { describe, it, expect } from "vitest";
import { matchPath, findOwningToolset } from "../pathAllowlist.js";

describe("matchPath", () => {
  it("allows core paths even when no toolsets are enabled", () => {
    expect(matchPath("/api/spaces", [])).toMatchObject({
      matched: true,
      toolset: "core",
    });
    expect(matchPath("/api/users/me", [])).toMatchObject({
      matched: true,
      toolset: "core",
    });
    expect(matchPath("/api/experimental/llms.txt", [])).toMatchObject({
      matched: true,
      toolset: "core",
    });
  });

  it("blocks toolset-scoped paths when their toolset is not enabled", () => {
    expect(matchPath("/api/Spaces-1/projects", [])).toMatchObject({
      matched: false,
    });
    expect(matchPath("/api/Spaces-1/releases", [])).toMatchObject({
      matched: false,
    });
  });

  it("allows a path when the matching toolset is enabled", () => {
    expect(matchPath("/api/Spaces-1/projects", ["projects"])).toMatchObject({
      matched: true,
      toolset: "projects",
    });
    expect(
      matchPath("/api/Spaces-1/releases/Releases-1", ["releases"]),
    ).toMatchObject({ matched: true, toolset: "releases" });
  });

  it("supports both space-prefix forms — bare spaceId AND /spaces/{slug-or-id}", () => {
    expect(
      matchPath("/api/Spaces-1/projects/Projects-1", ["projects"]),
    ).toMatchObject({ matched: true, toolset: "projects" });
    expect(
      matchPath("/api/spaces/Spaces-1/projects/Projects-1", ["projects"]),
    ).toMatchObject({ matched: true, toolset: "projects" });
    expect(
      matchPath("/api/spaces/default/projects/Projects-1", ["projects"]),
    ).toMatchObject({ matched: true, toolset: "projects" });
  });

  it("`**` matches across multiple segments", () => {
    expect(
      matchPath(
        "/api/Spaces-1/projects/Projects-1/deploymentprocesses/snapshot",
        ["projects"],
      ),
    ).toMatchObject({ matched: true });
  });

  it("does not match when the path falls outside any enabled toolset", () => {
    expect(matchPath("/api/Spaces-1/certificates", ["projects"])).toMatchObject(
      { matched: false },
    );
  });

  it("core does NOT pass through space sub-paths — toolset filtering is the kill switch", () => {
    // Codex regression: previously `core: /api/spaces/**` swallowed every
    // space-scoped path and short-circuited per-toolset gating. With core
    // narrowed, the /spaces/{id}/... form must require the owning toolset.
    expect(
      matchPath("/api/spaces/Spaces-1/certificates", ["projects"]),
    ).toMatchObject({ matched: false });
    expect(
      matchPath("/api/spaces/Spaces-1/certificates", ["certificates"]),
    ).toMatchObject({ matched: true, toolset: "certificates" });
    expect(
      matchPath("/api/spaces/Spaces-1/runbookruns/RunbookRuns-1", []),
    ).toMatchObject({ matched: false });
    expect(
      matchPath("/api/spaces/Spaces-1/runbookruns/RunbookRuns-1", ["runbooks"]),
    ).toMatchObject({ matched: true, toolset: "runbooks" });
  });

  it("core still allows top-level Space metadata so the space resolver works", () => {
    expect(matchPath("/api/spaces", [])).toMatchObject({
      matched: true,
      toolset: "core",
    });
    expect(matchPath("/api/spaces/Spaces-1", [])).toMatchObject({
      matched: true,
      toolset: "core",
    });
    expect(matchPath("/api/spaces/default", [])).toMatchObject({
      matched: true,
      toolset: "core",
    });
  });
});

describe("findOwningToolset", () => {
  it("names the toolset that owns a given path even when not enabled", () => {
    expect(findOwningToolset("/api/Spaces-1/certificates")).toBe("certificates");
    expect(findOwningToolset("/api/Spaces-1/runbooks/Runbooks-1")).toBe(
      "runbooks",
    );
  });

  it("returns undefined for paths no toolset claims", () => {
    expect(findOwningToolset("/api/something/never/registered")).toBeUndefined();
  });
});
