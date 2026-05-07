/**
 * GNU-grep-shaped line search over a multi-line string. Pure function, used by
 * grep_task_log (task activity logs) and grep_llms_txt (catalog markdown). Each
 * line is tested independently; matching lines are emitted with optional
 * symmetric context windows. Overlapping context between adjacent matches is
 * NOT deduplicated — each match carries its own complete context window so the
 * consumer can reason about each match in isolation. This is a deliberate
 * departure from GNU grep's `--`-separated output but it is the right shape
 * for a JSON tool response.
 */

export interface GrepLinesParams {
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

export interface GrepLinesResult {
  totalLines: number;
  totalMatches: number;
  matches: GrepMatch[];
}

export const MAX_CONTEXT = 50;
export const MAX_COUNT_HARD_CAP = 500;

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

export function grepLines(
  rawText: string,
  params: GrepLinesParams,
): GrepLinesResult {
  const {
    pattern,
    caseInsensitive = false,
    invertMatch = false,
    fixedString = false,
    beforeContext = 0,
    afterContext = 0,
    maxCount = 100,
  } = params;

  const lines = rawText.split("\n");
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
