import { type ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

// Every tool in this server hits a single user-configured Octopus instance with
// a fixed entity schema (releases, projects, environments, machines, tenants,
// ...). The SDK contrasts "web search" (open) with "memory tool" (closed); we
// fall on the closed side.
const CLOSED_WORLD = { openWorldHint: false } as const;

/** Read-only Octopus query tool: list/find/get/grep/read_resource. */
export const READ_ONLY_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  ...CLOSED_WORLD,
};

/** Write tool whose effect is purely additive — creates a new record, no overwrite. */
export const ADDITIVE_WRITE_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  ...CLOSED_WORLD,
};

/** Write tool that may overwrite or otherwise mutate live state. */
export const DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  ...CLOSED_WORLD,
};
