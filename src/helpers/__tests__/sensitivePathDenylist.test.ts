import { describe, it, expect } from "vitest";
import { isSensitive } from "../sensitivePathDenylist.js";

describe("isSensitive", () => {
  it("blocks API key endpoints regardless of method", () => {
    expect(isSensitive("GET", "/api/users/Users-1/apikeys")).toMatchObject({
      blocked: true,
    });
    expect(isSensitive("POST", "/api/users/me/apikeys")).toMatchObject({
      blocked: true,
    });
    expect(
      isSensitive("DELETE", "/api/users/Users-1/apikeys/ApiKeys-99"),
    ).toMatchObject({ blocked: true });
  });

  it("blocks user deletion via DELETE /api/users/{id} but not GET on the same path", () => {
    expect(isSensitive("DELETE", "/api/users/Users-1")).toMatchObject({
      blocked: true,
    });
    expect(isSensitive("GET", "/api/users/Users-1")).toMatchObject({
      blocked: false,
    });
  });

  it("blocks Space deletion via DELETE /api/spaces/{id}", () => {
    expect(isSensitive("DELETE", "/api/spaces/Spaces-1")).toMatchObject({
      blocked: true,
    });
  });

  it("does not block DELETE on nested space resources (e.g. feeds inside a space)", () => {
    expect(
      isSensitive("DELETE", "/api/spaces/Spaces-1/feeds/Feeds-2"),
    ).toMatchObject({ blocked: false });
  });

  it("does not over-match adjacent-but-distinct paths", () => {
    expect(
      isSensitive("GET", "/api/users/Users-1/permissions"),
    ).toMatchObject({ blocked: false });
    expect(isSensitive("POST", "/api/spaces")).toMatchObject({
      blocked: false,
    });
  });

  it("returns the entry's reason text when a path is blocked", () => {
    const result = isSensitive("DELETE", "/api/spaces/Spaces-1");
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/catastrophic/i);
  });

  it("treats glob metacharacters in the path literally (no regex injection)", () => {
    // A path containing regex metacharacters must not match anything outside
    // the literal denylist patterns.
    expect(isSensitive("GET", "/api/users/.+/apikeys")).toMatchObject({
      blocked: true, // `*` matches one segment, `.+` is one segment → matches.
    });
    expect(isSensitive("GET", "/api/projects(.*)")).toMatchObject({
      blocked: false, // not on the denylist; metacharacters are not honoured.
    });
  });
});
