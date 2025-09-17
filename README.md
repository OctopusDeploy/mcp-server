# 🐙 Octopus Deploy Official MCP Server (Early Access)

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) allows the AI assistants you use in your day to day work, like Claude Code, or ChatGPT, to connect to the systems and services you own in a standardized fashion, allowing them to pull information from those systems and services to answer questions and perform tasks.

The Octopus MCP Server provides your AI assistant with powerful tools that allow it to inspect, query, and diagnose problems within your Octopus instance, transforming it into your ultimate DevOps wingmate. 

This project is currently in Early Access, and subject to breaking changes.

### Octopus Server Compatibility

TODO: Make stronger guarantees about the version of server this will work against.

The MCP Server is developed and tested against versions `2025.3.x` of Octopus Server. Most of the APIs used are stable and exist in prior versions of Octopus and should therefore be generally compatible, but we will not be testing or deliberately maintaining compatibility with older versions of Octopus.

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

It is packaged as an npm package and executed via Node's `npx` command. Your configuration will include the command invocation `npx`, and a set of arguments that supply the Octoups MCP Server package and provide the Octopus Server URL and API key required, if they are not available as environment variables.

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
- **core** - Basic operations (always enabled) (`list_spaces`,`list_environments`)
- **projects** - Project operations (`list_projects`)
- **deployments** - Deployment operations (`list_deployments`, `get_latest_deployment`)
- **releases** - Release management (`get_release_by_id`, `list_releases`, `list_releases_for_project`)
- **tasks** - Task operations (`get_task_by_id`, `get_task_details`, `get_task_raw`)
- **tenants** - Multi-tenancy operations (`list_tenants`, `get_tenant_by_id`, `get_tenant_variables`, `get_missing_tenant_variables`)
- **kubernetes** - Kubernetes operations (`get_kubernetes_live_status`)
- **machines** - Deployment target operations (`list_deployment_targets`, `get_deployment_target`)

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

### Running from Github Registry (TODO: Remove)

This is a temporary workaround until we start publishing preview versions to the public npm registry. The following is assuming you are already signed in to the github registry.

1. In a new folder install dependencies manually:
```bash
npm install @octopusdeploy/api-client @modelcontextprotocol/sdk commander dotenv zod
```

2. Create `.npmrc` file with the following contents:
```bash
@octopusdeploy:registry=https://npm.pkg.github.com
```

3. Install the mcp-server:
```bash
npm install @octopusdeploy/mcp-server
```

4. Run it via:
```bash
npx "your/folders/full/path" -y @octopusdeploy/mcp-server
```

## 🔨 Tools

<details>
<summary>list_spaces</summary>

**Description**: List all spaces in the Octopus Deploy instance

**Parameters**: None

</details>

<details>
<summary>list_projects</summary>

**Description**: List projects in a space
  
  This tool lists all projects in a given space. The space name is required; if you can't find the space name, ask the user directly for the name of the space. Optionally filter by partial name match using partialName parameter.

**Parameters**: 
- `spaceName` (string, required): The space name
- `partialName` (string, optional): Filter by partial name match

</details>

<details>
<summary>list_environments</summary>

**Description**: List environments in a space
  
  This tool lists all environments in a given space. The space name is required. Optionally filter by partial name match using partialName parameter.

**Parameters**: 
- `spaceName` (string, required): The space name
- `partialName` (string, optional): Filter by partial name match

</details>

<details>
<summary>list_deployments</summary>

**Description**: List deployments in a space
  
  This tool lists deployments in a given space. The space name is required. Optional filters include: projects (array of project IDs), environments (array of environment IDs), tenants (array of tenant IDs), channels (array of channel IDs), taskState (one of: Canceled, Cancelling, Executing, Failed, Queued, Success, TimedOut), and take (number of results to return).

**Parameters**: 
- `spaceName` (string, required): The space name
- `projects` (array of strings, optional): Array of project IDs to filter by
- `environments` (array of strings, optional): Array of environment IDs to filter by
- `tenants` (array of strings, optional): Array of tenant IDs to filter by
- `channels` (array of strings, optional): Array of channel IDs to filter by
- `taskState` (string, optional): One of: Canceled, Cancelling, Executing, Failed, Queued, Success, TimedOut
- `take` (number, optional): Number of results to return

</details>

<details>
<summary>get_release_by_id</summary>

**Description**: Get details for a specific release by its ID

**Parameters**: 
- `spaceName` (string, required): The space name
- `releaseId` (string, required): The ID of the release to retrieve

</details>

<details>
<summary>list_releases</summary>

**Description**: List releases in a space
  
  This tool lists all releases in a given space. The space name is required. Optionally provide skip and take parameters for pagination.

**Parameters**: 
- `spaceName` (string, required): The space name
- `skip` (number, optional): Number of items to skip for pagination
- `take` (number, optional): Number of items to take for pagination

</details>

<details>
<summary>list_releases_for_project</summary>

**Description**: List releases for a specific project
  
  This tool lists all releases for a given project in a space. The space name and project ID are required. Optionally provide skip, take, and searchByVersion parameters.

**Parameters**: 
- `spaceName` (string, required): The space name
- `projectId` (string, required): The ID of the project to list releases for
- `skip` (number, optional): Number of items to skip for pagination
- `take` (number, optional): Number of items to take for pagination
- `searchByVersion` (string, optional): Search releases by version string

</details>

<details>
<summary>get_task_by_id</summary>

**Description**: Get details for a specific server task by its ID

**Parameters**: 
- `spaceName` (string, required): The space name
- `taskId` (string, required): The ID of the task to retrieve

</details>

<details>
<summary>get_task_details</summary>

**Description**: Get detailed information for a specific server task by its ID

**Parameters**: 
- `spaceName` (string, required): The space name
- `taskId` (string, required): The ID of the task to retrieve

</details>

<details>
<summary>get_task_raw</summary>

**Description**: Get raw details for a specific server task by its ID

**Parameters**: 
- `spaceName` (string, required): The space name
- `taskId` (string, required): The ID of the task to retrieve

</details>

<details>
<summary>list_deployment_targets</summary>

**Description**: List deployment targets (machines) in a space

This tool lists all deployment targets in a given space. The space name is required. You can optionally filter by various parameters like name, roles, health status, etc.

**Parameters**: 
- `spaceName` (string, required): The space name
- `skip` (number, optional): Number of items to skip for pagination
- `take` (number, optional): Number of items to take for pagination
- `name` (string, optional): Filter by exact name match
- `ids` (array of strings, optional): Array of deployment target IDs to filter by
- `partialName` (string, optional): Filter by partial name match
- `roles` (array of strings, optional): Array of roles to filter by
- `isDisabled` (boolean, optional): Filter by disabled status
- `healthStatuses` (array of strings, optional): Array of health statuses to filter by
- `commStyles` (array of strings, optional): Array of communication styles to filter by
- `tenantIds` (array of strings, optional): Array of tenant IDs to filter by
- `tenantTags` (array of strings, optional): Array of tenant tags to filter by
- `environmentIds` (array of strings, optional): Array of environment IDs to filter by
- `thumbprint` (string, optional): Filter by certificate thumbprint
- `deploymentId` (string, optional): Filter by deployment ID
- `shellNames` (array of strings, optional): Array of shell names to filter by
- `deploymentTargetTypes` (array of strings, optional): Array of deployment target types to filter by

</details>

<details>
<summary>get_deployment_target</summary>

**Description**: Get a specific deployment target (machine) by ID

This tool retrieves detailed information about a specific deployment target using its ID. The space name and target ID are both required.

**Parameters**: 
- `spaceName` (string, required): The space name
- `targetId` (string, required): The ID of the deployment target to retrieve

</details>

<details>
<summary>get_deployment_process</summary>

**Description**: Get deployment process by ID

This tool retrieves a deployment process by its ID. Each project has a deployment process attached, and releases/deployments can also have frozen processes attached.

**Parameters**: 
- `spaceName` (string, required): The space name
- `projectId` (string, optional): The ID of the project to retrieve the deployment process for. If processId is not provided, this parameter is required.
- `processId` (string, optional): The ID of the deployment process to retrieve. If not provided, the deployment process for the project will be retrieved.
- `branchName` (string, optional): Optional branch name to get the deployment process for a specific branch (if using version controlled projects). Try `main` or `master` if unsure.
- `includeDetails` (boolean, optional): Include detailed properties for steps and actions. Defaults to false.

</details>

<details>
<summary>get_branches</summary>

**Description**: Get Git branches for a version-controlled project

This tool retrieves Git branches for a specific project in a space. The space name and project ID are required. Optionally provide searchByName, skip, and take parameters for filtering and pagination.

**Parameters**: 
- `spaceName` (string, required): The space name
- `projectId` (string, required): The ID of the project
- `searchByName` (string, optional): Filter branches by partial name match
- `skip` (number, optional): Number of items to skip for pagination
- `take` (number, optional): Number of items to take for pagination

</details>

<details>
<summary>list_tenants</summary>

**Description**: List tenants in a space
  
  This tool lists all tenants in a given space. The space name is required. Optionally provide skip and take parameters for pagination.

**Parameters**: 
- `spaceName` (string, required): The space name
- `skip` (number, optional): Number of items to skip for pagination
- `take` (number, optional): Number of items to take for pagination
- `ids` (array of strings, optional): Filter by specific tenant IDs
- `partialName` (string, optional): Filter by partial tenant name match
- `projectId` (string, optional): Filter by specific project ID
- `tags` (string, optional): Filter by tenant tags (comma-separated list)

</details>

<details>
<summary>get_tenant_by_id</summary>

**Description**: Get details for a specific tenant by its ID

**Parameters**: 
- `spaceName` (string, required): The space name
- `tenantId` (string, required): The ID of the tenant to retrieve

</details>

<details>
<summary>get_tenant_variables</summary>

**Description**: Get tenant variables by type
  
  This tool retrieves different types of tenant variables. Use variableType parameter to specify which type:
  - "all": Get all tenant variables
  - "common": Get common variables only
  - "project": Get project-specific variables only

**Parameters**: 
- `spaceName` (string, required): The space name
- `tenantId` (string, required): The ID of the tenant to retrieve variables for
- `variableType` (string, required): Type of variables to retrieve (all, common, project)
- `includeMissingVariables` (boolean, optional): Include missing variables in the response (for common/project types)

</details>

<details>
<summary>get_missing_tenant_variables</summary>

**Description**: Get missing tenant variables
  
  This tool retrieves tenant variables that are missing values. Optionally filter by tenant, project, or environment.

**Parameters**: 
- `spaceName` (string, required): The space name
- `tenantId` (string, optional): Filter by specific tenant ID
- `projectId` (string, optional): Filter by specific project ID
- `environmentId` (string, optional): Filter by specific environment ID
- `includeDetails` (boolean, optional): Include detailed information about missing variables

</details>

<details>
<summary>get_kubernetes_live_status</summary>

**Description**: Get Kubernetes live status for a project and environment
  
  This tool retrieves the live status of Kubernetes resources for a specific project and environment. Optionally include a tenant ID for multi-tenant deployments.

**Parameters**: 
- `spaceName` (string, required): The space name
- `projectId` (string, required): The ID of the project
- `environmentId` (string, required): The ID of the environment
- `tenantId` (string, optional): The ID of the tenant (for multi-tenant deployments)
- `summaryOnly` (boolean, optional): Return summary information only

</details>

<details>
<summary>get_current_user</summary>

**Description**: Get information about the current authenticated user

This tool retrieves information about the currently authenticated user from the Octopus Deploy API.

**Parameters**: None

</details>

## Security Considerations

While the Octopus MCP Server at this stage is a read-only tool, it **can read full deployment logs, which could include production secrets.** Exercise caution when connecting Octopus MCP to tools and models you do not fully trust.

Running agents in a fully automated fashion could make you vulnerable to exposure via prompt-injection attacks that exfiltrate tokens.

Exercise caution and mitigate the risks by using least-privileged accounts when connecting to Octopus Server.

## Limitations

### Data Analysis

The nature of current AI chat tools and the MCP protocol itself makes it impractical to analyze large amounts of data. Most MCP clients currently do not support chaining tool calls (using the output of one tool as input to the next one) and instead fall back to copying the results token by token, which frequently leads to hallucinations. If you are looking to process historical data from your Octopus instance for analysis purposes, we recommend using the API directly or writing your own MCP client that is capable of processing the tool call results programmatically.

### Performance

The MCP Server is technically just a thin layer on top of the existing Octopus Server API. As such it is capable of retrieving large amounts of data (for example, requesting thousands of deployments). Such queries can have a significant effect on your instance's performance. Instruct your models to only retrieve the minimum set of data that it needs (most models are really good at this out of the box).

## Contributing

We are eager to hear how you plan to use Octopus MCP Server and what features you would like to see included in future version. 

Please use [Issues](https://github.com/OctopusDeploy/mcp-server/issues) to provide feedback, or request features.

If you are a current Octopus customer, please report any issues you experience using our MCP server to our [support team](mailto:support@octoups.com). This will ensure you get a timely response within our standard support guarantees.

## FAQ

### Do you have plans to release a remote MCP server?

We are working on integrating an MCP server directly into Octopus Server. This will open up the door for us to build more complex MCP tools, as well as:

* Giving Octopus Administrators more granular control over MCP clients
* Natively support OAuth for client authentication
* Integrating security scanning tools into the MCP output

## License

This project is licensed under the terms of Apache 2.0 open source license.
