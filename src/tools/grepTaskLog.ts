import { Client, SpaceServerTaskRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";

export interface GrepTaskLogParams {
  spaceName: string;
  taskId: string;
  pattern: string;
  caseInsensitive?: boolean;
  invertMatch?: boolean;
  fixedString?: boolean;
  beforeContext?: number;
  afterContext?: number;
  maxCount?: number;
}

export interface ContextLine {
  lineNumber: number;
  line: string;
}

export interface GrepMatch {
  lineNumber: number;
  line: string;
  before?: ContextLine[];
  after?: ContextLine[];
}

export interface GrepTaskLogResult {
  spaceName: string;
  taskId: string;
  pattern: string;
  totalLines: number;
  totalMatches: number;
  returnedMatches: number;
  truncated: boolean;
  matches: GrepMatch[];
  /**
   * URI for the structured ActivityLogs tree if the agent needs more than
   * grep can express (e.g. step hierarchy, category filtering, timing).
   */
  taskDetailsResourceUri: string;
}

const MAX_CONTEXT = 50;
const MAX_COUNT_HARD_CAP = 500;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePattern(
  pattern: string,
  caseInsensitive: boolean,
  fixedString: boolean,
): RegExp {
  const source = fixedString ? escapeRegExp(pattern) : pattern;
  const flags = caseInsensitive ? "i" : "";
  try {
    return new RegExp(source, flags);
  } catch (error) {
    throw new Error(
      `Invalid pattern: ${error instanceof Error ? error.message : String(error)}. ` +
        "Set fixedString:true to treat the pattern as a literal substring instead of a regex.",
    );
  }
}

/**
 * Pure-function grep implementation. Exported for unit tests.
 *
 * Mirrors GNU grep's line-by-line semantics: each line is tested independently,
 * matching lines are emitted with optional symmetric context windows. Overlapping
 * context between adjacent matches is NOT deduplicated — each match carries its
 * own complete context window so the consumer can reason about each match in
 * isolation. This is a deliberate departure from GNU grep's `--`-separated
 * output but it is the right shape for a JSON tool response.
 */
export function grepLines(
  rawLog: string,
  params: GrepTaskLogParams,
): { totalLines: number; totalMatches: number; matches: GrepMatch[] } {
  const {
    pattern,
    caseInsensitive = false,
    invertMatch = false,
    fixedString = false,
    beforeContext = 0,
    afterContext = 0,
    maxCount = 100,
  } = params;

  const lines = rawLog.split("\n");
  // Drop the trailing empty element produced by a final newline.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const regex = compilePattern(pattern, caseInsensitive, fixedString);

  const matches: GrepMatch[] = [];
  let totalMatches = 0;

  for (let i = 0; i < lines.length; i++) {
    const isMatch = regex.test(lines[i]) !== invertMatch;
    if (!isMatch) continue;

    totalMatches++;
    if (matches.length >= maxCount) continue;

    const match: GrepMatch = {
      lineNumber: i + 1,
      line: lines[i],
    };

    if (beforeContext > 0) {
      const start = Math.max(0, i - beforeContext);
      match.before = lines.slice(start, i).map((line, idx) => ({
        lineNumber: start + idx + 1,
        line,
      }));
    }

    if (afterContext > 0) {
      const end = Math.min(lines.length, i + 1 + afterContext);
      match.after = lines.slice(i + 1, end).map((line, idx) => ({
        lineNumber: i + 2 + idx,
        line,
      }));
    }

    matches.push(match);
  }

  return { totalLines: lines.length, totalMatches, matches };
}

const inputSchema = {
  spaceName: z
    .string()
    .describe("Octopus space name. Case-sensitive."),
  taskId: z
    .string()
    .describe("ServerTasks-XXXX ID. Use find_releases or list_deployments to discover task IDs from their parent entities."),
  pattern: z
    .string()
    .min(1)
    .describe(
      "Regex (default) or literal substring (when fixedString=true). Anchors and groups behave as in JavaScript RegExp. Tested against each log line independently — the same model as `grep`.",
    ),
  caseInsensitive: z
    .boolean()
    .default(false)
    .describe("Equivalent to grep -i. Default false."),
  invertMatch: z
    .boolean()
    .default(false)
    .describe("Equivalent to grep -v: return lines that do NOT match. Default false."),
  fixedString: z
    .boolean()
    .default(false)
    .describe("Equivalent to grep -F: treat pattern as a literal substring, not a regex. Use this when grepping for text containing regex metacharacters. Default false."),
  beforeContext: z
    .number()
    .int()
    .min(0)
    .max(MAX_CONTEXT)
    .default(0)
    .describe(`Equivalent to grep -B: lines of preceding context to include with each match. Capped at ${MAX_CONTEXT}.`),
  afterContext: z
    .number()
    .int()
    .min(0)
    .max(MAX_CONTEXT)
    .default(0)
    .describe(`Equivalent to grep -A: lines of trailing context to include with each match. Capped at ${MAX_CONTEXT}.`),
  maxCount: z
    .number()
    .int()
    .min(1)
    .max(MAX_COUNT_HARD_CAP)
    .default(100)
    .describe(`Equivalent to grep -m: stop returning matches after this many. totalMatches in the response still reflects the true count across the whole log. Hard cap ${MAX_COUNT_HARD_CAP}.`),
};

export function registerGrepTaskLogTool(server: McpServer) {
  server.registerTool(
    "grep_task_log",
    {
      title: "Grep an Octopus task activity log",
      description: `Search a server task's activity log with grep-style semantics. Returns only matching lines (with optional symmetric context windows). This is the canonical way to inspect task logs — there is no full-log resource URI, because exposing one would tempt callers to inhale multi-megabyte bodies when grep is almost always the better primitive.

Use this when you know what to look for (a specific error string, a step name, a pattern). For structured access to the activity tree (step hierarchy, categories, timing) use the octopus://spaces/{spaceName}/tasks/{taskId}/details resource instead.

Parameter conventions mirror GNU grep so the schema is self-explanatory:
- pattern (regex by default; set fixedString:true for literal text)
- caseInsensitive   (-i)
- invertMatch       (-v)
- fixedString       (-F)
- beforeContext     (-B)
- afterContext      (-A)
- maxCount          (-m)

Response includes totalMatches (true count across the whole log), totalLines, the matched lines with 1-indexed lineNumber, optional before/after context arrays, and a taskDetailsResourceUri for the structured fall-through.`,
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const params = args as GrepTaskLogParams;
      const { spaceName, taskId } = params;

      validateEntityId(taskId, "task", ENTITY_PREFIXES.task);

      try {
        const client = await Client.create(
          getClientConfigurationFromEnvironment(),
        );
        const rawLog = await new SpaceServerTaskRepository(
          client,
          spaceName,
        ).getRaw(taskId);

        const { totalLines, totalMatches, matches } = grepLines(rawLog, params);

        const result: GrepTaskLogResult = {
          spaceName,
          taskId,
          pattern: params.pattern,
          totalLines,
          totalMatches,
          returnedMatches: matches.length,
          truncated: totalMatches > matches.length,
          matches,
          taskDetailsResourceUri: `octopus://spaces/${encodeURIComponent(spaceName)}/tasks/${encodeURIComponent(taskId)}/details`,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, {
          entityType: "task",
          entityId: taskId,
          spaceName,
          helpText:
            "Use find_releases or list_deployments to discover task IDs via their parent entity. Use get_task_from_url to resolve a task ID from an Octopus portal URL.",
        });
      }
    },
  );
}

registerToolDefinition({
  toolName: "grep_task_log",
  config: { toolset: "tasks", readOnly: true },
  registerFn: registerGrepTaskLogTool,
});
