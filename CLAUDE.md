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
# Test with environment variables
OCTOPUS_API_KEY=API-KEY OCTOPUS_SERVER_URL=https://your-octopus.com npm start

# Test with command line arguments
npm start -- --server-url https://your-octopus.com --api-key YOUR_API_KEY
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
1. Environment variables: `OCTOPUS_API_KEY`, `OCTOPUS_SERVER_URL`
2. CLI arguments: `--api-key`, `--server-url`
3. Toolset filtering: `--toolsets` to enable specific tool groups
4. Version checking: `--list-tools-by-version` to see tool compatibility

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
- **Conventional Commits**: All commits must follow the format (e.g., `feat:`, `fix:`, `chore:`)
- **Branch Protection**: Direct pushes to `main` are not allowed
- **GitHub Actions**: Automated build and publish workflows
- **Release Please**: Automated version management and changelog generation

When making changes:
1. Create a feature branch
2. Use conventional commit messages
3. Submit a PR and use "Squash and Merge" when merging
4. The release workflow handles npm publishing automatically

**PR titles and descriptions**: PR titles must follow Conventional Commits format (e.g., `feat: add action templates tool`, `fix: handle missing space name`). Release Please uses the squashed PR title to generate changelogs and determine version bumps, so the title must be correct before merging.