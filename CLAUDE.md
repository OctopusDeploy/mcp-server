# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the Octopus Deploy Official MCP Server, which provides Model Context Protocol (MCP) tools that allow AI assistants like Claude Code to interact with Octopus Deploy instances. The server is implemented in TypeScript as a Node.js application.

## Key Commands

### Development
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Development mode with file watching
npm run lint         # Run ESLint on src/ directory
npm start            # Run compiled server from dist/
```

### Testing the Server
```bash
# Credentials must be supplied via environment variables (they are not accepted as CLI flags
# to avoid exposure in the host process list).
OCTOPUS_API_KEY=API-KEY OCTOPUS_SERVER_URL=https://your-octopus.com npm start

# Server URL may also be supplied via the --server-url flag:
OCTOPUS_API_KEY=API-KEY npm start -- --server-url https://your-octopus.com
```

## Architecture

### Core Structure
- **src/index.ts**: Entry point that sets up the MCP server, parses CLI arguments, and initializes the transport layer
- **src/tools/index.ts**: Tool registration system that loads all available tools based on configuration
- **src/types/toolConfig.ts**: Tool configuration system with toolsets and version tracking

### Tool System
Tools self-register into `TOOL_REGISTRY` and are organized by toolsets:
- `core`: Basic operations (spaces, environments)
- `projects`, `deployments`, `releases`: Project lifecycle operations
- `tasks`, `tenants`, `kubernetes`, `machines`, `certificates`: Specialized operations

Each tool file exports a registration that includes:
- Tool name and handler function
- Toolset classification
- Read-only flag (all tools are currently read-only)
- Minimum Octopus version requirement (optional)

#### MCP SDK: use `registerTool`, not `tool`

`server.tool(...)` is **deprecated** in `@modelcontextprotocol/sdk` and only accepts a `ZodRawShapeCompat` (a flat object of zod schemas) as its input schema. Refined schemas (`z.object(...).superRefine(...)`, `z.discriminatedUnion(...)`, etc.) cannot be used with `tool()` — TypeScript will reject the assignment.

New tools must use `server.registerTool(name, config, handler)`:

```typescript
import { READ_ONLY_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";

server.registerTool(
  "find_releases",
  {
    title: "Find releases",
    description: "...",
    inputSchema: refinedZodSchema, // accepts ZodRawShapeCompat OR a full zod schema with refinements
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
  },
  async (args) => { /* ... */ },
);
```

Use `superRefine` (or a discriminated union) to encode cross-field invariants — mutually exclusive arguments, required-when-other-present rules, etc. — so the SDK rejects bad combinations during input validation and the LLM gets a structured error rather than a silent override at runtime. Constraints expressed only in description prose are not enforced.

When migrating existing tools from `tool()` to `registerTool()`: the description and annotations move into the config object as named fields (`description`, `annotations`); the input schema becomes `inputSchema`. The handler signature is unchanged.

##### Annotation constants

All four MCP `ToolAnnotations` hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) should be set explicitly so well-behaved clients can derive correct UI affordances (auto-approve, confirm-before-run, etc.) instead of falling back to worst-case defaults. To keep these consistent across tools, use the constants in [`src/types/toolAnnotations.ts`](src/types/toolAnnotations.ts):

- `READ_ONLY_TOOL_ANNOTATIONS` — every read/list/find/get tool, plus `read_resource` and `grep_task_log`.
- `ADDITIVE_WRITE_TOOL_ANNOTATIONS` — write tools whose effect is purely additive (create a new record, no overwrite). Example: `create_release`.
- `DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS` — write tools that may overwrite or otherwise mutate live state. Example: `deploy_release`.

All three set `openWorldHint: false` because the server is bound to a single configured Octopus instance with a fixed entity schema — that's a closed world, not an open one (the SDK contrasts "web search" / open with "memory tool" / closed). Don't hand-roll an inline annotations object; reach for one of the constants and add a new profile to `toolAnnotations.ts` if a genuinely new shape appears.

#### Write gating: use `requireConfirmation`

Tools that mutate state (deploy, create, run, submit, delete, non-GET `execute`) must call `requireConfirmation` from `src/helpers/requireConfirmation.ts` before performing the write, and return early when `confirmed` is false. The helper handles three branches transparently:

1. `OCTOPUS_SKIP_ELICITATION=true` env var → bypass (automation/CI). Strict string equality with `"true"`.
2. Client advertises elicitation capability → SDK emits `elicitation/create` and the helper returns `{ confirmed: result.action === "accept" }`. `decline` and `cancel` both map to `false`.
3. Client does not advertise elicitation → helper falls back to the `confirm` arg the tool surfaced in its own input schema.

Branch 3 requires every write tool's input schema to include a `confirm` field:

```typescript
confirm: z
  .boolean()
  .optional()
  .describe(
    "Required only when the MCP client does not support elicitation. " +
    "Set to true to confirm the write; otherwise the tool aborts.",
  ),
```

Pass it through as `fallbackConfirm`. The helper returns a discriminated `ConfirmationResult` so callers can distinguish "user said no" from "user was never asked" — surface the latter as a hard error so the LLM stops and asks the user instead of treating the response as a real cancellation. The `unconfirmedResponse` builder produces the standard tool response for both branches; pass it the result and a lowercase noun phrase for the gated action:

```typescript
import {
  requireConfirmation,
  unconfirmedResponse,
} from "../helpers/requireConfirmation.js";

const confirmation = await requireConfirmation(server, {
  message: `Deploy release ${version} to ${environment}?`,
  fallbackConfirm: args.confirm,
});
if (!confirmation.confirmed) {
  return unconfirmedResponse(confirmation, { action: "deployment" });
}
```

`reason` values: `accepted` / `envSkip` / `fallbackConfirm` (confirmed); `declined` / `cancelled` / `confirmationRequired` (not confirmed). `confirmationRequired` is the one `unconfirmedResponse` flags with `isError: true` — it means the gate is unreachable for this client+args combination, not that the user objected.

The handler closure captures `server` from the outer `register*Tool(server)` function — handlers do not receive `server` as an argument from the SDK. Place the gate after argument validation but before any expensive work (API client construction, network calls), so users don't spend an elicitation round-trip on a call that would have failed validation anyway.

### Resource System

Resources are addressable bodies fetched by URI (e.g. `octopus://spaces/Default/releases/Releases-1`). Each Resource is a single descriptor record in `RESOURCE_REGISTRY` with a URI template, mimeType, toolset, and an async `read` callback. Both the SDK Resource Template registration and the `read_resource` Tool backstop iterate the same registry, so adding a new resource type is one record — no edits to a central dispatcher.

URI variables come back from the SDK's matcher percent-encoded; the dispatch layer URL-decodes before handing them to the `read` callback, so handlers receive plain strings.

#### `stripLinks` for api-client passthrough

Octopus REST responses include a HATEOAS `Links` map of hypermedia URLs (self, related collections, etc.) that LLM consumers don't need and that bloats the payload. **Resource handlers that return an api-client object as JSON should pass it through `stripLinks` (`src/helpers/stripLinks.ts`) first:**

```typescript
import { stripLinks } from "../helpers/stripLinks.js";

read: async ({ spaceName, releaseId }) => {
  const release = await new ReleaseRepository(client, spaceName).get(releaseId);
  return {
    mimeType: "application/json",
    text: JSON.stringify(stripLinks(release)),
  };
},
```

When **not** to use it:
- The handler is constructing a custom JSON shape from scratch (slim summaries, etc.) rather than passing an api-client object through. There's nothing to strip.
- Tool responses that aren't api-client passthroughs (most `find_*` tools build their own shape).

Don't hand-pick fields off an api-client object as a substitute — the LLM reads PascalCase as well as camelCase, and a manual field map adds maintenance burden without payoff. The api-client's TypeScript types don't always declare `Links` even though the runtime payload includes it; `stripLinks` accepts any `object` and returns `Record<string, unknown>` to handle that gap.

### Client Configuration
The server accepts configuration via:
1. Credentials (env vars only): `OCTOPUS_API_KEY` or `OCTOPUS_ACCESS_TOKEN`
2. Server URL: `OCTOPUS_SERVER_URL` env var or `--server-url` CLI flag
3. Toolset filtering: `--toolsets` to enable specific tool groups
4. Version checking: `--list-tools-by-version` to see tool compatibility

Credentials are deliberately not accepted as CLI flags — they would be visible to any local user via `ps aux` / `/proc/<pid>/cmdline`.

## TypeScript Style Guide

### Import Statements
- Use `.js` extensions for local imports (required for ESM modules)
- Import types explicitly using `type` keyword
- Group imports: external packages first, then local imports

```typescript
import { Client, SpaceRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
```

### Type Definitions
- Define interfaces for structured data
- Use `type` for unions and aliases
- Export types from dedicated type files in `src/types/`

```typescript
export type Toolset = "core" | "projects" | "deployments";
export interface ToolConfig {
  toolset: Toolset;
  readOnly: boolean;
}
```

### Function Signatures
- Use explicit return types for public functions
- Use descriptive parameter names
- Document complex functions with JSDoc comments

```typescript
/**
 * Set custom log file path
 * @param filePath Path to the log file (can be full path or just filename)
 */
function setLogFilePath(filePath: string): void {
  // implementation
}
```

### Async/Await
- Always use async/await over promise chains
- Handle errors appropriately with try/catch

### Naming Conventions
- PascalCase for types, interfaces, and enums
- camelCase for variables, functions, and properties
- UPPER_SNAKE_CASE for constants
- Descriptive names over abbreviations

### Module Exports
- Export individual functions/types rather than default exports
- Group related exports in barrel files (`index.ts`)

## Contribution Process

This project uses:
- **Branch Protection**: Direct pushes to `main` are not allowed
- **GitHub Actions**: Automated build and publish workflows
- **Release Please**: Automated version management and changelog generation

When making changes:
1. Create a feature branch
2. Use conventional commit messages (e.g., `feat:`, `fix:`, `chore:`)
3. Submit a PR and use "Squash and Merge" when merging
4. The release workflow handles npm publishing automatically

## Creating Pull Requests

PR titles **must** follow Conventional Commits format (e.g., `feat: add action templates tool`,
`fix: handle missing space name`). This project uses "Squash and Merge" — the PR title becomes
the commit message that Release Please reads to generate changelogs and bump versions.