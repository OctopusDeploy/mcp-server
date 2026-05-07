import { Client, SpaceServerTaskRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import {
  validateEntityId,
  handleOctopusApiError,
  ENTITY_PREFIXES,
} from "../helpers/errorHandling.js";
import {
  grepLines,
  MAX_CONTEXT,
  MAX_COUNT_HARD_CAP,
  type GrepMatch,
} from "../helpers/grepLines.js";

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
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
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
