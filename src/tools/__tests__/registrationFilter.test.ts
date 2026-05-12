import { describe, it, expect } from "vitest";
import { isToolEnabled } from "../index.js";
import { type ToolRegistration } from "../../types/toolConfig.js";

function fakeRegistration(
  toolName: string,
  toolset: ToolRegistration["config"]["toolset"],
  readOnly: boolean,
  methodGated?: boolean,
): ToolRegistration {
  return {
    toolName,
    config: { toolset, readOnly, methodGated },
    registerFn: () => {},
  };
}

describe("isToolEnabled — read-only mode and methodGated bypass", () => {
  it("registers static read-only tools in read-only mode", () => {
    const reg = fakeRegistration("list_spaces", "core", true);
    expect(isToolEnabled(reg, { readOnlyMode: true })).toBe(true);
  });

  it("hides static write tools in read-only mode", () => {
    const reg = fakeRegistration("create_release", "releases", false);
    expect(
      isToolEnabled(reg, { enabledToolsets: "all", readOnlyMode: true }),
    ).toBe(false);
  });

  it("keeps methodGated tools registered in read-only mode even though they're not statically read-only", () => {
    const reg = fakeRegistration("execute", "core", false, true);
    expect(isToolEnabled(reg, { readOnlyMode: true })).toBe(true);
  });

  it("registers write tools when read-only mode is off", () => {
    const reg = fakeRegistration("create_release", "releases", false);
    expect(
      isToolEnabled(reg, { enabledToolsets: "all", readOnlyMode: false }),
    ).toBe(true);
  });

  it("hides tools whose toolset is not enabled, regardless of readOnly", () => {
    const reg = fakeRegistration("find_certificates", "certificates", true);
    expect(
      isToolEnabled(reg, {
        enabledToolsets: ["releases"],
        readOnlyMode: false,
      }),
    ).toBe(false);
  });

  it("always registers core-toolset tools regardless of enabledToolsets", () => {
    const reg = fakeRegistration("list_spaces", "core", true);
    expect(
      isToolEnabled(reg, {
        enabledToolsets: ["releases"],
        readOnlyMode: false,
      }),
    ).toBe(true);
  });
});
