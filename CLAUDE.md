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