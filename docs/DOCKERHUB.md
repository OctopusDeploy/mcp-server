# Octopus Deploy MCP Server (deprecated)

> **Deprecated:** This MCP server is deprecated and no longer recommended for new installations. The Remote MCP Server is built into Octopus Server 2026.3 and later. See the [Remote MCP Server documentation](https://octopus.com/docs/octopus-ai/mcp/remote).

The Octopus MCP Server gives your AI assistant tools to inspect, query, and diagnose problems in your Octopus Deploy instance.

## Usage

Supply credentials through environment variables. Credentials passed as command-line flags would be visible in the host process list.

```bash
docker run -i --rm -e OCTOPUS_API_KEY=your-key -e OCTOPUS_SERVER_URL=https://your-octopus.com octopusdeploy/mcp-server
```

For full configuration, tools, and security guidance, see the [GitHub repository](https://github.com/OctopusDeploy/mcp-server).
