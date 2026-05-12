import { describe, it, expect } from "vitest";
import { validateExecutePath } from "../validateExecutePath.js";

describe("validateExecutePath", () => {
  it("accepts simple absolute paths", () => {
    expect(validateExecutePath("/api/spaces")).toEqual({
      ok: true,
      path: "/api/spaces",
    });
    expect(
      validateExecutePath("/api/Spaces-1/projects/Projects-1"),
    ).toEqual({
      ok: true,
      path: "/api/Spaces-1/projects/Projects-1",
    });
  });

  it("rejects empty or non-absolute paths", () => {
    expect(validateExecutePath("")).toEqual({
      ok: false,
      reason: expect.stringContaining("non-empty"),
    });
    expect(validateExecutePath("api/spaces")).toEqual({
      ok: false,
      reason: expect.stringContaining("must start with"),
    });
  });

  it("rejects '..' segments anywhere in the path", () => {
    // The motivating bypass — Codex flagged this exact shape.
    expect(
      validateExecutePath("/api/spaces/Spaces-1/../../users/me/apikeys"),
    ).toMatchObject({ ok: false });
    expect(validateExecutePath("/../etc/passwd")).toMatchObject({ ok: false });
    expect(validateExecutePath("/api/..")).toMatchObject({ ok: false });
    // A segment that *contains* `..` but isn't exactly `..` is allowed
    // (real Octopus IDs don't have this shape, but the rule is segment-exact
    // to avoid false positives like "/api/foo..bar").
    expect(validateExecutePath("/api/foo..bar")).toMatchObject({ ok: true });
  });

  it("rejects backslashes (Windows path injection)", () => {
    expect(validateExecutePath("/api/spaces\\..\\users")).toMatchObject({
      ok: false,
    });
  });

  it("rejects query strings and fragments — they belong in dedicated args", () => {
    expect(validateExecutePath("/api/spaces?take=10")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("query string"),
    });
    expect(validateExecutePath("/api/spaces#section")).toMatchObject({
      ok: false,
    });
  });

  it("rejects percent-encoded slashes that would unhide a denylist path", () => {
    // /api/users%2Fme%2Fapikeys would match a literal pattern but resolves
    // to /api/users/me/apikeys after URL decoding.
    expect(validateExecutePath("/api/users%2Fme%2Fapikeys")).toMatchObject({
      ok: false,
    });
    expect(validateExecutePath("/api/users%2fme")).toMatchObject({ ok: false });
    expect(validateExecutePath("/api/foo%5cbar")).toMatchObject({ ok: false });
  });

  it("rejects double slashes (allowlist anchoring assumes single-segment separators)", () => {
    expect(validateExecutePath("/api//spaces")).toMatchObject({ ok: false });
  });

  it("permits percent-encoded characters that aren't slashes or backslashes", () => {
    // Space names can be percent-encoded — `default%20space` is a legitimate
    // segment value. Only %2F and %5C are dangerous.
    expect(
      validateExecutePath("/api/spaces/default%20space"),
    ).toMatchObject({ ok: true });
  });

  it("rejects paths outside the /api surface so execute stays bounded", () => {
    // execute is a backstop for the Octopus REST API, not a general
    // server-relative request tool. With the allowlist now bypassed when all
    // toolsets are enabled, /api/ enforcement here is what keeps execute
    // from reaching arbitrary server-side resources (portal HTML, auth
    // endpoints, etc.) just because the agent prefixed a slash.
    expect(validateExecutePath("/some-other-path")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("/api"),
    });
    expect(validateExecutePath("/")).toMatchObject({ ok: false });
    expect(validateExecutePath("/octopus/portal")).toMatchObject({
      ok: false,
    });
  });

  it("rejects /apiXXX where XXX is any continuation other than '/' — only `/api` or `/api/...` is valid", () => {
    expect(validateExecutePath("/api2")).toMatchObject({ ok: false });
    expect(validateExecutePath("/apifoo")).toMatchObject({ ok: false });
  });

  it("accepts exactly `/api` (the API root endpoint)", () => {
    // The Octopus API root returns metadata about the API itself; some
    // discovery flows GET it directly.
    expect(validateExecutePath("/api")).toEqual({ ok: true, path: "/api" });
  });

  it("rejects absolute URLs and SDK-relative paths — execute takes server-relative paths only", () => {
    // Models sometimes hallucinate the full origin or the api-client's `~`
    // prefix. Reject explicitly so the failure is informative rather than
    // resolving to a confusing URL.
    expect(validateExecutePath("https://octopus.example/api/spaces")).toMatchObject({
      ok: false,
    });
    expect(validateExecutePath("~/api/spaces")).toMatchObject({ ok: false });
  });
});
