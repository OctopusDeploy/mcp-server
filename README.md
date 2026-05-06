<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/octopusdeploy/mcp-server/blob/main/images/OctopusDeploy_Logo_DarkMode.png?raw=true">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/octopusdeploy/mcp-server/blob/main/images/OctopusDeploy_Logo_LightMode.png?raw=true">
  <img alt="Octopus Deploy Logo" src="https://github.com/octopusdeploy/mcp-server/blob/main/images/OctopusDeploy_Logo_LightMode.png?raw=true" />
</picture>

# Octopus Deploy Official MCP Server

[Octopus](https://octopus.com) makes it easy to deliver software to Kubernetes, multi-cloud, on-prem infrastructure, and anywhere else. Automate the release, deployment, and operations of your software and AI workloads with a tool that can handle CD at scale in ways no other tool can.

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) allows the AI assistants you use in your day to day work, like Claude Code, or ChatGPT, to connect to the systems and services you own in a standardized fashion, allowing them to pull information from those systems and services to answer questions and perform tasks.

The Octopus MCP Server provides your AI assistant with powerful tools that allow it to inspect, query, and diagnose problems within your Octopus instance, transforming it into your ultimate DevOps wingmate. For a list of supported use-cases and sample prompts, see our [documentation](https://octopus.com/docs/octopus-ai/mcp/use-cases).

### Octopus Server Compatibility

Most tools exposed by the MCP Server use stable APIs that have been available from at least version `2021.1` of Octopus Server. Tools that are newer will specify the minimum supported version in the documentation. Alternatively, you can use the command line argument `--list-tools-by-version` to check how specific tools relate to versions of Octopus.

## 🚀 Installation

### Install via Docker

Credentials must be supplied via environment variables to avoid exposing them in the host process list (`ps aux` / `/proc/<pid>/cmdline`). The Octopus server URL can still be supplied via the `--server-url` flag.

```bash
docker run -i --rm -e OCTOPUS_API_KEY=your-key -e OCTOPUS_SERVER_URL=https://your-octopus.com octopusdeploy/mcp-server
```

Full example configuration (for Claude Desktop, Claude Code, and Cursor):
```json
{
  "mcpServers": {
    "octopus-deploy": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "OCTOPUS_SERVER_URL",
        "-e",
        "OCTOPUS_API_KEY",
        "octopusdeploy/mcp-server"
      ],
      "env": {
        "OCTOPUS_SERVER_URL": "https://your-octopus.com",
        "OCTOPUS_API_KEY": "YOUR_API_KEY"
      }
    },
  }
}
```

For Apple Mac users, you might need to add the following arguments in the configuration to force Docker to use the Linux platform:
```json
"--platform",
"linux/amd64",
```

We are planning to release a native ARM build shortly so that those arguments will not be required anymore.

### Install via Node

#### Requirements
- Node.js >= v20.0.0
- Octopus Deploy instance that can be accessed by the MCP server via HTTPS
- Octopus Deploy API Key or Access Token (see [Authentication](#authentication) below)

#### Configuration

Full example configuration (for Claude Desktop, Claude Code, and Cursor):

**Read-only mode (default, recommended for production):**
```json
{
  "mcpServers": {
    "octopusdeploy": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@octopusdeploy/mcp-server"],
      "env": {
        "OCTOPUS_SERVER_URL": "https://your-octopus.com",
        "OCTOPUS_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

**Write mode enabled (for development/testing):**
```json
{
  "mcpServers": {
    "octopusdeploy": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@octopusdeploy/mcp-server", "--no-read-only"],
      "env": {
        "OCTOPUS_SERVER_URL": "https://your-octopus.com",
        "OCTOPUS_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

The Octopus MCP Server is typically configured within your AI Client of choice.

It is packaged as an npm package and executed via Node's `npx` command. Credentials (API key or access token) must be supplied via environment variables — they are not accepted as command-line arguments to avoid exposing secrets in the process list. The Octopus server URL may be supplied via either the `OCTOPUS_SERVER_URL` environment variable or the `--server-url` flag.

```bash
OCTOPUS_API_KEY=API-KEY \
OCTOPUS_SERVER_URL=https://your-octopus.com \
npx -y @octopusdeploy/mcp-server
```

Or with the server URL on the command line:
```bash
OCTOPUS_API_KEY=API-KEY \
npx -y @octopusdeploy/mcp-server --server-url https://your-octopus.com
```

### Authentication

The MCP server supports two authentication methods. Both are supplied via environment variables — credentials are not accepted on the command line because flags are visible in the host process list to any local user.

#### API Key (recommended for interactive use)

API keys are the standard authentication method for Octopus Deploy. You can generate one from your Octopus Deploy user profile.

```bash
OCTOPUS_API_KEY=API-XXXXXXXXXXXXXXXXXXXXXXXXXX \
OCTOPUS_SERVER_URL=https://your-octopus.com \
npx -y @octopusdeploy/mcp-server
```

#### Access Token / Bearer Token (automated scenarios only)

The server also supports short-lived access tokens (Bearer tokens) as an alternative to API keys. This authentication method is intended **only for automated scenarios** where an external system issues a short-lived token to the MCP server (e.g., CI/CD pipelines, automated orchestration, or machine-to-machine workflows). Do not use long-lived Bearer tokens — use API keys instead for interactive or long-running sessions.

```bash
OCTOPUS_ACCESS_TOKEN=your-short-lived-token \
OCTOPUS_SERVER_URL=https://your-octopus.com \
npx -y @octopusdeploy/mcp-server
```

Full example configuration with an access token:
```json
{
  "mcpServers": {
    "octopusdeploy": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@octopusdeploy/mcp-server"],
      "env": {
        "OCTOPUS_SERVER_URL": "https://your-octopus.com",
        "OCTOPUS_ACCESS_TOKEN": "YOUR_TOKEN"
      }
    }
  }
}
```

If both an API key and an access token are provided, the access token takes precedence. The active authentication method is recorded in the log file (configurable with `--log-file`) so operators can confirm which credential is in use.

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
- **accounts** - Account operations

#### Read-Only Mode
The server runs in read-only mode by default for security. Most tools are read-only operations, but some tools can perform write operations (like creating releases and deployments).

**Write-enabled tools:**
- `create_release` - Create new releases
- `deploy_release` - Deploy releases to environments and tenants

To use write-enabled tools, you must explicitly disable read-only mode:

```bash
# Run in read-only mode (default) - write tools are disabled
npx -y @octopusdeploy/mcp-server

# Disable read-only mode to enable write operations
npx -y @octopusdeploy/mcp-server --no-read-only
```

**Security Note:** When disabling read-only mode, ensure you use an API key with appropriate, least-privilege permissions. Write operations can create releases and trigger deployments in your Octopus instance.

#### Complete Examples

All examples below assume `OCTOPUS_API_KEY` is set in the environment. The `--server-url` flag is shown for clarity but can also be provided via `OCTOPUS_SERVER_URL`.

```bash
# Development setup with only core and project tools
npx -y @octopusdeploy/mcp-server --toolsets core,projects --server-url https://your-octopus.com

# Full production setup with all tools (read-only by default)
npx -y @octopusdeploy/mcp-server --toolsets all --server-url https://your-octopus.com

# Development setup with write operations enabled
npx -y @octopusdeploy/mcp-server --no-read-only --server-url https://your-octopus.com
```

#### Other command line arguments

* `--log-level <level>` - Minimum log level (info, error)
* `--log-file <path>` - Log file path or filename. If not specified, logs are written to console only
* `-q, --quiet` - Disable file logging, only log errors to console
* `--list-tools-by-version` - List all registered tools by their supported Octopus Server version and exit

## 🔨 Tools

### URL-Based Tools

**Quick start**: Paste Octopus URLs directly to investigate issues without manual ID extraction.

- `get_deployment_from_url`: Get deployment details from deployment URL (returns taskId for follow-up)
- `get_task_from_url`: Get task details and logs from task URL

**Deployment investigation workflow:**
```
1. get_deployment_from_url with deployment URL
   → Returns deployment context + taskResourceUri + grepTaskLogHint

2a. Fetch the structured activity tree via resources/read (or read_resource)
    octopus://spaces/{spaceName}/tasks/{taskId}/details

2b. Or call grep_task_log with the taskId to search the raw log without
    fetching the full body:
       grep_task_log({ spaceName, taskId, pattern: "error|fail", caseInsensitive: true })
```

**Task investigation** (direct task URL):
```
get_task_from_url with task URL
→ Returns task details and logs immediately
```

These tools eliminate manual ID extraction by:
- Parsing URLs automatically
- Resolving space IDs to space names
- Validating ID formats
- Providing clear error messages

**Example URLs:**
- Deployment: `https://your-octopus.com/app#/Spaces-1/projects/my-app/deployments/Deployments-123`
- Task: `https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456`

See [Working with URLs](docs/working-with-urls.md) for detailed workflows, examples, and best practices.

### Core Tools
- `list_spaces`: List all spaces in the Octopus Deploy instance
- `list_environments`: List all environments in a given space

### Projects
- `list_projects`: List all projects in a given space

### Deployments
- `deploy_release`: Deploy a release to environments (supports both tenanted and untenanted deployments)
- `list_deployments`: List deployments in a space with optional filtering

### Releases
- `create_release`: Create a new release for a project
- `find_releases`: Find releases in a space (can get a specific release by ID or list all releases)
- `list_releases_for_project`: List all releases for a specific project

### Tasks
Task data is primarily exposed as MCP Resources. Use `resources/read` (or the `read_resource` backstop tool) with one of:

- `octopus://spaces/{spaceName}/tasks/{taskId}` — lightweight metadata (state, timing, completion flags)
- `octopus://spaces/{spaceName}/tasks/{taskId}/details` — full ServerTaskDetails (Progress, ActivityLogs tree, etc.)

For log search, use the `grep_task_log` tool rather than a `/log` resource:

- `grep_task_log`: Search a task's activity log without fetching the full body. Parameters mirror GNU grep (`pattern`, `caseInsensitive`, `invertMatch`, `fixedString`, `beforeContext`, `afterContext`, `maxCount`). Returns matching lines with 1-indexed `lineNumber`, optional before/after context arrays, and a `totalMatches` count across the whole log.

There is intentionally no `/log` resource: activity logs can be multi-megabyte, and an addressable resource would tempt callers to fetch the entire body when grep is almost always the right primitive.

### Tenants
- `find_tenants`: Find tenants in a space (can get a specific tenant by ID or list/search tenants with filters)
- `get_tenant_variables`: Get tenant variables by type (all, common, or project)
- `get_missing_tenant_variables`: Get tenant variables that are missing values

### Kubernetes
- `get_kubernetes_live_status`: Get live status of Kubernetes resources for a project and environment (minimum supported version: `2025.3`)

### Machines (Deployment Targets)
- `find_deployment_targets`: Find deployment targets in a space (can get a specific target by ID or list/search targets with filters)

### Certificates
- `find_certificates`: Find certificates in a space (can get a specific certificate by ID or list/search certificates with filters)

### Accounts
- `find_accounts`: Find accounts in a space (can get a specific account by ID or list/search accounts with filters)

### Additional Tools
- `get_deployment_process`: Get deployment process by ID for projects or releases
- `get_branches`: Get Git branches for a version-controlled project (minimum supported version: `2021.2`)
- `get_current_user`: Get information about the current authenticated user

## 🔒 Security Considerations

The Octopus MCP Server includes both read and write operations. Important security considerations:

### Read Operations
- Can read full deployment logs, which could include production secrets if they were not marked as secrets
- Access to sensitive configuration data and variables
- Exercise caution when connecting to tools and models you do not fully trust

### Write Operations
When read-only mode is disabled (`--no-read-only`), the following write operations are available:
- **Creating releases**: Can create new releases for projects
- **Deploying releases**: Can trigger deployments to environments (including production)

**Critical Security Measures:**
1. **Least Privilege**: Use API keys with the minimum permissions needed for your use case
2. **Read-Only by Default**: The server defaults to read-only mode - you must explicitly opt-in to write operations
3. **Prompt Injection Risk**: Running agents in fully automated fashion could make you vulnerable to prompt-injection attacks

**Recommendation**: For production environments, use read-only mode unless you have a specific, controlled use case for write operations.

## ⚠️ Limitations

### Data Analysis

The nature of current AI chat tools and the MCP protocol itself makes it impractical to analyze large amounts of data. Most MCP clients currently do not support chaining tool calls (using the output of one tool as input to the next one) and instead fall back to copying the results token by token, which frequently leads to hallucinations. If you are looking to process historical data from your Octopus instance for analysis purposes, we recommend using the API directly or writing your own MCP client that is capable of processing the tool call results programmatically.

### Performance

The MCP Server is technically just a thin layer on top of the existing Octopus Server API. As such it is capable of retrieving large amounts of data (for example, requesting thousands of deployments). Such queries can have a significant effect on your instance's performance. Instruct your models to only retrieve the minimum set of data that it needs (most models are really good at this out of the box).

## 🤝 Contributions

Contributions are welcome! :heart: Please read our [Contributing Guide](CONTRIBUTING.md) for information about how to get involved in this project.

We are eager to hear how you plan to use Octopus MCP Server and what features you would like to see included in future version. 

Please use [Issues](https://github.com/OctopusDeploy/mcp-server/issues) to provide feedback, or request features.

If you are a current Octopus customer, please report any issues you experience using our MCP server to our [support team](mailto:support@octopus.com). This will ensure you get a timely response within our standard support guarantees.

## 🙋 FAQ

### Do you have plans to release a remote MCP server?

We are working on integrating an MCP server directly into Octopus Server. This will open up the door for us to build more complex MCP tools, as well as:

* Giving Octopus Administrators more granular control over MCP clients
* Natively support OAuth for client authentication
* Integrating security scanning tools into the MCP output

If this is of interest to you, please register your interest on [our roadmap item](https://roadmap.octopus.com/c/228-remote-mcp-server-ai-).

## License

This project is licensed under the terms of Mozilla Public License 2.0 open source license.
