# 🐙 Octopus Deploy Official MCP Server (Early Access)

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) allows the AI assistants you use in your day to day work, like Claude Code, or ChatGPT, to connect to the systems and services you own in a standardized fashion, allowing them to pull information from those systems and services to answer questions and perform tasks.

The Octopus MCP Server provides your AI assistant with powerful tools that allow it to inspect, query, and diagnose problems within your Octopus instance, transforming it into your ultimate DevOps wingmate. 

This project is currently in Early Access, and subject to breaking changes.

### Octopus Server Compatibility

Most tools exposed by the MCP Server use stable APIs that have been available from at least version `2021.1` of Octopus Server. Tools that are newer will specify the minimum supported version in the documentation. Alternatively, you can use the command line argument `--list-tools-by-version` to check how specific tools relate to versions of Octopus.

## 🚀 Installation

### Requirements
- Node.js >= v20.0.0
- Octopus Deploy instance that can be accessed by the MCP server via HTTPS
- Octopus Deploy API Key

### Configuration

Full example configuration (for Claude Desktop, Claude Code, and Cursor):
```json
{
  "mcpServers": {
    "octopusdeploy": {
      "command": "npx",
      "args": ["-y", "@octopusdeploy/mcp-server", "--api-key", "YOUR_API_KEY", "--server-url", "https://your-octopus.com"]
    }
  }
}
```

The Octopus MCP Server is typically configured within your AI Client of choice. 

It is packaged as an npm package and executed via Node's `npx` command. Your configuration will include the command invocation `npx`, and a set of arguments that supply the Octopus MCP Server package and provide the Octopus Server URL and API key required, if they are not available as environment variables.

The command line invocation you will be configuring will be one of the two following variants:

```bash
npx -y @octopusdeploy/mcp-server
```

With configuration provided via environment variables:
```bash
OCTOPUS_API_KEY=API-KEY
OCTOPUS_SERVER_URL=https://your-octopus.com
```

Or with configuration supplied via the command line:
```bash
npx -y @octopusdeploy/mcp-server --server-url https://your-octopus.com --api-key YOUR_API_KEY
```

### Configuration Options

The Octopus MCP Server supports several command-line options to customize which tools are available. 

If you are not sure which tools you require, we recommend running without any additional command-line options and using the provided defaults.

#### Toolsets
Use the `--toolsets` parameter to enable specific groups of tools:

```bash
# Enable all toolsets (default)
npx -y @octopusdeploy/mcp-server

# Enable only specific toolsets
npx -y @octopusdeploy/mcp-server --toolsets projects,deployments

# Enable all toolsets explicitly
npx -y @octopusdeploy/mcp-server --toolsets all
```

Available toolsets:
- **core** - Basic operations (always enabled)
- **projects** - Project operations
- **deployments** - Deployment operations
- **releases** - Release management
- **tasks** - Task operations
- **tenants** - Multi-tenancy operations
- **kubernetes** - Kubernetes operations
- **machines** - Deployment target operations
- **certificates** - Certificate operations

#### Read-Only Mode
The server runs in read-only mode by default for security. All current tools are read-only operations.

```bash
# Run in read-only mode (default)
npx -y @octopusdeploy/mcp-server --read-only

# Disable read-only mode (currently no effect as all tools are read-only)
npx -y @octopusdeploy/mcp-server --read-only=false
```

#### Complete Examples

```bash
# Development setup with only core and project tools
npx -y @octopusdeploy/mcp-server --toolsets core,projects --server-url https://your-octopus.com --api-key YOUR_API_KEY

# Full production setup with all tools
npx -y @octopusdeploy/mcp-server --toolsets all --read-only --server-url https://your-octopus.com --api-key YOUR_API_KEY
```

## 🔨 Tools

### Core Tools
- `list_spaces`: List all spaces in the Octopus Deploy instance
- `list_environments`: List all environments in a given space

### Projects
- `list_projects`: List all projects in a given space

### Deployments
- `list_deployments`: List deployments in a space with optional filtering

### Releases
- `get_release_by_id`: Get details for a specific release by its ID
- `list_releases`: List all releases in a given space
- `list_releases_for_project`: List all releases for a specific project

### Tasks
- `get_task_by_id`: Get details for a specific server task by its ID
- `get_task_details`: Get detailed information for a specific server task
- `get_task_raw`: Get raw details for a specific server task

### Tenants
- `list_tenants`: List all tenants in a given space
- `get_tenant_by_id`: Get details for a specific tenant by its ID
- `get_tenant_variables`: Get tenant variables by type (all, common, or project)
- `get_missing_tenant_variables`: Get tenant variables that are missing values

### Kubernetes
- `get_kubernetes_live_status`: Get live status of Kubernetes resources for a project and environment (minimum supported version: `2025.3`)

### Machines (Deployment Targets)
- `list_deployment_targets`: List all deployment targets in a space with optional filtering
- `get_deployment_target`: Get detailed information about a specific deployment target

### Certificates
- `list_certificates`: List all certificates in a space with optional filtering
- `get_certificate`: Get detailed information about a specific certificate by its ID

### Additional Tools
- `get_deployment_process`: Get deployment process by ID for projects or releases
- `get_branches`: Get Git branches for a version-controlled project (minimum supported version: `2021.2`)
- `get_current_user`: Get information about the current authenticated user

## Security Considerations

While the Octopus MCP Server at this stage is a read-only tool, it **can read full deployment logs, which could include production secrets.** Exercise caution when connecting Octopus MCP to tools and models you do not fully trust.

Running agents in a fully automated fashion could make you vulnerable to exposure via prompt-injection attacks that exfiltrate tokens.

Exercise caution and mitigate the risks by using least-privileged accounts when connecting to Octopus Server.

## Limitations

### Data Analysis

The nature of current AI chat tools and the MCP protocol itself makes it impractical to analyze large amounts of data. Most MCP clients currently do not support chaining tool calls (using the output of one tool as input to the next one) and instead fall back to copying the results token by token, which frequently leads to hallucinations. If you are looking to process historical data from your Octopus instance for analysis purposes, we recommend using the API directly or writing your own MCP client that is capable of processing the tool call results programmatically.

### Performance

The MCP Server is technically just a thin layer on top of the existing Octopus Server API. As such it is capable of retrieving large amounts of data (for example, requesting thousands of deployments). Such queries can have a significant effect on your instance's performance. Instruct your models to only retrieve the minimum set of data that it needs (most models are really good at this out of the box).

## 🤝 Contributions

Contributions are welcome! :heart: Please read our [Contributing Guide](CONTRIBUTING.md) for information about how to get involved in this project.

We are eager to hear how you plan to use Octopus MCP Server and what features you would like to see included in future version. 

Please use [Issues](https://github.com/OctopusDeploy/mcp-server/issues) to provide feedback, or request features.

If you are a current Octopus customer, please report any issues you experience using our MCP server to our [support team](mailto:support@octopus.com). This will ensure you get a timely response within our standard support guarantees.

## FAQ

### Do you have plans to release a remote MCP server?

We are working on integrating an MCP server directly into Octopus Server. This will open up the door for us to build more complex MCP tools, as well as:

* Giving Octopus Administrators more granular control over MCP clients
* Natively support OAuth for client authentication
* Integrating security scanning tools into the MCP output

If this is of interest to you, please register your interest on [our roadmap item](https://roadmap.octopus.com/c/228-remote-mcp-server-ai-).

## License

This project is licensed under the terms of Mozilla Public License 2.0 open source license.
