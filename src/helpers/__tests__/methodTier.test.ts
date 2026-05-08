import { describe, it, expect } from "vitest";
import { classifyMethod, HTTP_METHODS } from "../methodTier.js";

describe("classifyMethod", () => {
  it("classifies GET as the read tier", () => {
    expect(classifyMethod("GET")).toBe("read");
  });

  it("classifies POST, PUT, PATCH as the write tier", () => {
    expect(classifyMethod("POST")).toBe("write");
    expect(classifyMethod("PUT")).toBe("write");
    expect(classifyMethod("PATCH")).toBe("write");
  });

  it("classifies DELETE as its own delete tier (separate from write)", () => {
    expect(classifyMethod("DELETE")).toBe("delete");
  });

  it("HTTP_METHODS enumerates exactly the five supported verbs", () => {
    expect([...HTTP_METHODS].sort()).toEqual([
      "DELETE",
      "GET",
      "PATCH",
      "POST",
      "PUT",
    ]);
  });
});
