import { describe, it, expect } from "vitest";
import { createToolsetConfig, parseToolsets } from "../parseConfig.js";

describe("createToolsetConfig", () => {
  it("defaults readOnlyMode to false (writes enabled) when --read-only is not set", () => {
    const config = createToolsetConfig(undefined, undefined, undefined);
    expect(config.readOnlyMode).toBe(false);
  });

  it("sets readOnlyMode to true when --read-only is passed", () => {
    const config = createToolsetConfig(undefined, true, undefined);
    expect(config.readOnlyMode).toBe(true);
  });

  it("defaults allowDeletes to false", () => {
    const config = createToolsetConfig(undefined, undefined, undefined);
    expect(config.allowDeletes).toBe(false);
  });

  it("passes allowDeletes through when set", () => {
    const config = createToolsetConfig(undefined, undefined, true);
    expect(config.allowDeletes).toBe(true);
  });

  it("defaults enabledToolsets to 'all' when no --toolsets arg is given", () => {
    const config = createToolsetConfig(undefined, undefined, undefined);
    expect(config.enabledToolsets).toBe("all");
  });
});

describe("parseToolsets", () => {
  it("returns 'all' when arg is undefined", () => {
    expect(parseToolsets(undefined)).toBe("all");
  });

  it("returns 'all' when arg is the literal 'all'", () => {
    expect(parseToolsets("all")).toBe("all");
  });

  it("splits a comma-separated list and trims whitespace", () => {
    expect(parseToolsets("core, projects ,deployments")).toEqual([
      "core",
      "projects",
      "deployments",
    ]);
  });

  it("throws for an unknown toolset name", () => {
    expect(() => parseToolsets("core,bogus")).toThrow(/Invalid toolsets: bogus/);
  });
});
