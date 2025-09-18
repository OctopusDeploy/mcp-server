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