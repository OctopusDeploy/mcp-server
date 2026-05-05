import { describe, it, expect } from "vitest";
import { grepLines } from "../grepTaskLog.js";

const SAMPLE_LOG = [
  "2026-05-05T12:00:00 Info  | Step 1 starting",
  "2026-05-05T12:00:01 Info  | Acquiring packages",
  "2026-05-05T12:00:02 Warn  | Package version mismatch detected",
  "2026-05-05T12:00:03 Info  | Step 1 finished",
  "2026-05-05T12:00:04 Info  | Step 2 starting",
  "2026-05-05T12:00:05 Error | Connection timeout to database",
  "2026-05-05T12:00:06 Error | Step 2 failed: see above",
  "2026-05-05T12:00:07 Info  | Cleanup",
  "",
].join("\n");

const baseParams = {
  spaceName: "Default",
  taskId: "ServerTasks-1",
  pattern: "",
};

describe("grepLines", () => {
  it("returns line-numbered matches for a literal regex pattern", () => {
    const result = grepLines(SAMPLE_LOG, { ...baseParams, pattern: "Error" });

    expect(result.totalMatches).toBe(2);
    expect(result.matches.map((m) => m.lineNumber)).toEqual([6, 7]);
    expect(result.matches[0].line).toContain("Connection timeout");
  });

  it("treats pattern as a regex by default", () => {
    const result = grepLines(SAMPLE_LOG, {
      ...baseParams,
      pattern: "Step \\d finished",
    });

    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].lineNumber).toBe(4);
  });

  it("caseInsensitive flag matches grep -i", () => {
    const sensitive = grepLines(SAMPLE_LOG, {
      ...baseParams,
      pattern: "error",
    });
    const insensitive = grepLines(SAMPLE_LOG, {
      ...baseParams,
      pattern: "error",
      caseInsensitive: true,
    });

    expect(sensitive.totalMatches).toBe(0);
    expect(insensitive.totalMatches).toBe(2);
  });

  it("invertMatch flag matches grep -v", () => {
    const result = grepLines(SAMPLE_LOG, {
      ...baseParams,
      pattern: "Info",
      invertMatch: true,
    });

    // 8 non-empty lines total, 5 are Info → 3 non-Info matches
    expect(result.totalMatches).toBe(3);
    expect(result.matches.map((m) => m.lineNumber)).toEqual([3, 6, 7]);
  });

  it("fixedString flag escapes regex metacharacters (grep -F)", () => {
    const log = "alpha (1)\nbeta (2)\ngamma (3)\n";

    // Without -F, "(1)" is a regex group capturing the literal "1" — matches only that line.
    const regex = grepLines(log, {
      ...baseParams,
      pattern: "(1)",
    });
    expect(regex.totalMatches).toBe(1);

    // With -F, the parentheses are literal.
    const fixed = grepLines(log, {
      ...baseParams,
      pattern: "(1)",
      fixedString: true,
    });
    expect(fixed.totalMatches).toBe(1);
    expect(fixed.matches[0].line).toBe("alpha (1)");

    // And -F should not throw on input that would be invalid regex.
    expect(() =>
      grepLines(log, { ...baseParams, pattern: "(unbalanced", fixedString: true }),
    ).not.toThrow();
  });

  it("invalid regex pattern throws a friendly error suggesting fixedString", () => {
    expect(() =>
      grepLines("anything\n", { ...baseParams, pattern: "(unbalanced" }),
    ).toThrow(/fixedString:true/);
  });

  it("beforeContext and afterContext mirror grep -B / -A", () => {
    const result = grepLines(SAMPLE_LOG, {
      ...baseParams,
      pattern: "Connection timeout",
      beforeContext: 2,
      afterContext: 1,
    });

    expect(result.matches).toHaveLength(1);
    const [match] = result.matches;
    expect(match.lineNumber).toBe(6);
    expect(match.before?.map((c) => c.lineNumber)).toEqual([4, 5]);
    expect(match.after?.map((c) => c.lineNumber)).toEqual([7]);
  });

  it("context windows clip at log boundaries", () => {
    const result = grepLines(SAMPLE_LOG, {
      ...baseParams,
      pattern: "Step 1 starting",
      beforeContext: 3,
    });

    expect(result.matches[0].lineNumber).toBe(1);
    expect(result.matches[0].before).toEqual([]);
  });

  it("maxCount caps returned matches but totalMatches reflects the true count", () => {
    const result = grepLines(SAMPLE_LOG, {
      ...baseParams,
      pattern: "Info",
      maxCount: 2,
    });

    expect(result.totalMatches).toBe(5);
    expect(result.matches).toHaveLength(2);
    expect(result.matches.map((m) => m.lineNumber)).toEqual([1, 2]);
  });

  it("totalLines excludes the trailing empty element from a final newline", () => {
    const result = grepLines("one\ntwo\nthree\n", {
      ...baseParams,
      pattern: ".",
    });

    expect(result.totalLines).toBe(3);
    expect(result.totalMatches).toBe(3);
  });

  it("handles a log with no trailing newline", () => {
    const result = grepLines("one\ntwo\nthree", {
      ...baseParams,
      pattern: "two",
    });

    expect(result.totalLines).toBe(3);
    expect(result.totalMatches).toBe(1);
    expect(result.matches[0].lineNumber).toBe(2);
  });

  it("returns empty matches array when nothing matches", () => {
    const result = grepLines(SAMPLE_LOG, {
      ...baseParams,
      pattern: "no-such-string",
    });

    expect(result.totalMatches).toBe(0);
    expect(result.matches).toEqual([]);
  });
});
