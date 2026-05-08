/**
 * Tiny safe glob engine for matching Octopus REST paths in the `execute`
 * tool's allowlist and sensitive denylist. Two wildcard tokens:
 *
 *   - `*`  matches a single path segment (no `/` allowed)
 *   - `**` matches any sequence of characters, including `/`
 *
 * Every other character is treated literally — regex metacharacters are
 * escaped at compile time, so denylist and allowlist entries cannot be turned
 * into regex injection by a clever path. Patterns are anchored to the full
 * input via `^…$`, so `/api/projects` does NOT match `/api/projects/Projects-1`.
 */

const COMPILED = new Map<string, RegExp>();

export function compilePathGlob(pattern: string): RegExp {
  const cached = COMPILED.get(pattern);
  if (cached) return cached;

  let regexSource = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        regexSource += ".*";
        i += 2;
        continue;
      }
      regexSource += "[^/]+";
      i += 1;
      continue;
    }
    if (/[.+?^${}()|[\]\\]/.test(ch)) {
      regexSource += "\\" + ch;
    } else {
      regexSource += ch;
    }
    i += 1;
  }

  const compiled = new RegExp("^" + regexSource + "$");
  COMPILED.set(pattern, compiled);
  return compiled;
}

export function pathMatchesGlob(path: string, pattern: string): boolean {
  return compilePathGlob(pattern).test(path);
}
