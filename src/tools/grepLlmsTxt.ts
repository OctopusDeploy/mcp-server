import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import {
  grepLines,
  MAX_CONTEXT,
  MAX_COUNT_HARD_CAP,
  type GrepLinesParams,
  type GrepMatch,
} from "../helpers/grepLines.js";
import { fetchLlmsTxt } from "../resources/catalog/llmsTxt.js";

export interface GrepLlmsTxtResult {
  pattern: string;
  totalLines: number;
  totalMatches: number;
  returnedMatches: number;
  truncated: boolean;
  matches: GrepMatch[];
  catalogResourceUri: string;
}

const inputSchema = {
  pattern: z
    .string()
    .min(1)
    .describe(
      "Regex (default) or literal substring (when fixedString=true). Tested against each line of llms.txt independently — same model as `grep`.",
    ),
  caseInsensitive: z
    .boolean()
    .default(false)
    .describe("Equivalent to grep -i. Default false."),
  invertMatch: z
    .boolean()
    .default(false)
    .describe(
      "Equivalent to grep -v: return lines that do NOT match. Default false.",
    ),
  fixedString: z
    .boolean()
    .default(false)
    .describe(
      "Equivalent to grep -F: treat pattern as a literal substring, not a regex. Use this when grepping for text containing regex metacharacters. Default false.",
    ),
  beforeContext: z
    .number()
    .int()
    .min(0)
    .max(MAX_CONTEXT)
    .default(0)
    .describe(
      `Equivalent to grep -B: lines of preceding context to include with each match. Capped at ${MAX_CONTEXT}.`,
    ),
  afterContext: z
    .number()
    .int()
    .min(0)
    .max(MAX_CONTEXT)
    .default(0)
    .describe(
      `Equivalent to grep -A: lines of trailing context to include with each match. Capped at ${MAX_CONTEXT}.`,
    ),
  maxCount: z
    .number()
    .int()
    .min(1)
    .max(MAX_COUNT_HARD_CAP)
    .default(100)
    .describe(
      `Equivalent to grep -m: stop returning matches after this many. totalMatches in the response still reflects the true count across the whole file. Hard cap ${MAX_COUNT_HARD_CAP}.`,
    ),
};

export function registerGrepLlmsTxtTool(server: McpServer) {
  server.registerTool(
    "grep_llms_txt",
    {
      title: "Grep the Octopus API catalog (llms.txt)",
      description: `Search the Octopus API catalog at octopus://api/llms.txt with grep-style semantics. The catalog is large (~300+ KB) — call this rather than reading the resource body directly.

llms.txt is structured as:
- Authentication and Space Selection sections (top of file)
- Endpoints section: one '### {Category}' heading per resource family (Accounts, ActionTemplates, Channels, Releases, …) and one bullet per endpoint of the form
    \`- \\\`METHOD /path\\\` - description | Prefixes (pick one): /{spaceId}, /spaces/{spaceIdentifier} | ?queryParams → ReturnType\`
- Steps section: deployment step types (Octopus.* ActionType) and their configurable property keys.

Useful patterns:
- 'POST /releases'   — find write endpoints under a resource family
- 'DELETE '          — enumerate delete endpoints
- '### Channels'     — jump to a section heading
- 'Body: Create.*Command' — find endpoints that take a Create command body

Parameter conventions mirror GNU grep:
- pattern (regex by default; set fixedString:true for literal text)
- caseInsensitive   (-i)
- invertMatch       (-v)
- fixedString       (-F)
- beforeContext     (-B)
- afterContext      (-A)
- maxCount          (-m)

Response: totalMatches (true count across the whole file), totalLines, the matched lines with 1-indexed lineNumber, optional before/after context arrays, and catalogResourceUri for the structured fall-through.`,
      inputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      const params = args as GrepLinesParams;

      const body = await fetchLlmsTxt();
      const { totalLines, totalMatches, matches } = grepLines(body, params);

      const result: GrepLlmsTxtResult = {
        pattern: params.pattern,
        totalLines,
        totalMatches,
        returnedMatches: matches.length,
        truncated: totalMatches > matches.length,
        matches,
        catalogResourceUri: "octopus://api/llms.txt",
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );
}

registerToolDefinition({
  toolName: "grep_llms_txt",
  config: { toolset: "core", readOnly: true },
  registerFn: registerGrepLlmsTxtTool,
  // The /api/experimental/llms.txt endpoint shipped in Octopus 2026.2.3916.
  minimumOctopusVersion: "2026.2.3916",
});
