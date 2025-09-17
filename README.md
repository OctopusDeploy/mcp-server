# 🐙 Octopus Deploy Official MCP Server

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) allows the AI assistants you use in your day to day work, like Claude Code, or ChatGPT, to connect to the systems and services you own in a standardized fashion, allowing them to pull information from those systems and services to answer questions and perform tasks.

The Octopus MCP Server provides your AI assistant with powerful tools that allow it to inspect, query, and diagnose problems within your Octopus instance, transforming it into your ultimate DevOps wingmate. 

This project should currently be considered unstable, and subject to breaking changes. In the future, we may offer stability; please file an issue if there is a use case where this would be valuable.

### Octopus Server Compatibility

The MCP Server is developed and tested against versions `2025.3.x` of Octopus Server. Most of the APIs used are stable and exist in prior versions of Octopus and should therefore be generally compatible, but we will not be testing or deliberately maintaining compatibility with older versions of Octopus.

## ⚠️ Security Disclaimer ⚠️

While the Octopus MCP Server at this stage is a read-only tool, it **can read full deployment logs, which could include secrets stored in your Octopus Server, such as production keys.** Exercise caution when connecting Octopus MCP to tools and models you do not fully trust.

Running agents in a fully automated fashion could make you vulnerable to exposure via prompt-injection attacks that exfiltrate tokens.

Exercise caution and mitigate the risks by using least-privileged accounts when connecting to Octopus Server.

## 🚀 Installation

### Requirements
- Node.js >= v20.0.0
- Cursor, Claude Code, VSCode, Windsurf or another MCP Client
- Octopus Deploy instance that can be accessed remotely
- Octopus Deploy API Key

### Command Line
```bash
npx -y @octopusdeploy/mcp-server
```

Connection details for your Octopus Deploy instance can be supplied either via the command line:
```bash
npx -y @octopusdeploy/mcp-server --server-url https://your-octopus.com --api-key YOUR_API_KEY
```

Or via environment variables:
```bash
OCTOPUS_API_KEY=API-KEY
OCTOPUS_SERVER_URL=https://your-octopus.com
```

<details>
<summary><b>Install via JSON config (Cursor, Claude Desktop, etc.)</b></summary>

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

</details>

### Configuration Options

The Octopus MCP Server supports several command-line options to customize which tools are available:

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

### Running from Github Registry

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

## Use Cases

<details>
<summary>Customer X have submitted a support ticket complaining that there is a bug in the latest release of App. Can you tell me what release they are on, when it was deployed, and if there were any issues with the deployment?</summary>

```
"I'll help you investigate Customer X's App deployment. Let me start by checking what spaces are available and then look into their current release and deployment status.Let me try a broader search to see all available spaces first:I can see there's an ""App"" space which is likely where Customer X would be deployed. Let me check the projects in that space:Now let me check the environments in this space to understand the deployment structure:Now let me check if there are any tenants, as Customer X would likely be a tenant in the Cloud Customers environment:Great! I found the Customer X tenant. Now let me get the latest deployment for this tenant:Now let me get details about the latest release to see what version they're running:Now let me check the deployment task details to see if there were any issues:Perfect! Now let me also check the previous deployment to see if there were any issues there that might give context to their bug report:Based on my investigation of Customer X's App deployment, here's what I found:

## Current Status Summary

**Current Release**: Customer X is running **App version 2025.4.X**

**Deployment Date**: The latest deployment was completed on **September 11, 2025 at 11:26:07 PM +00:00** (yesterday)

**Deployment Status**: The deployment was **completely successful** with no errors or warnings

## Deployment Details

- **Tenant**: Customer X (11111-11111-11111-11111)
- **Environment**: Cloud Customers
- **Task ID**: ServerTasks-12610852
- **Duration**: 2 minutes 12 seconds
- **Status**: Success with no issues

## Previous Release

The previous deployment was:
- **Version**: 2025.3.X
- **Deployed**: September 11, 2025 at 2:22:51 AM +00:00 
- **Status**: Also successful with no deployment issues

## Analysis

Both the current deployment (2025.4.X) and the previous deployment (2025.3.X) completed successfully without any errors, warnings, or deployment-related issues. This suggests that:

1. The bug they're reporting is likely a functional issue with version 2025.4.X rather than a deployment problem
2. The deployment infrastructure and process are working correctly
3. They upgraded from 2025.3.X to 2025.4.X on September 11th, so the bug is likely related to changes introduced in the 2025.4.x branch

You may want to investigate what specific changes were made between versions 2025.3.X and 2025.4.X to help identify the root cause of their reported bug."
```

</details>

### Limitations

#### Data Analysis

The nature of current AI chat tools and the MCP protocol itself makes it impractical to analyze large amounts of data. Most MCP clients currently do not support chaining tool calls (using the output of one tool as input to the next one) and instead fall back to copying the results token by token, which frequently leads to hallucinations. If you are looking to process historical data from your Octopus instance for analysis purposes, we recommend using the API directly or writing your own MCP client that is capable of processing the tool call results programmatically.

#### Performance

The MCP Server is technically just a thin layer on top of the existing Octopus Server API. As such it is capable of retrieving large amounts of data (for example, requesting thousands of deployments). Such queries can have a significant effect on your instance's performance. Instruct your models to only retrieve the minimum set of data that it needs (most models are really good at this out of the box).

## Contributing

We are eager to hear how you plan to use Octopus MCP server and what features you would like to see us build. Use  [Issues](https://github.com/OctopusDeploy/mcp-server/issues) to provide feedback, log bugs or request features.

## FAQ

### Do you have plans to release a remote MCP server?

We are working on integrating an MCP server directly into Octopus Server. This will open up the door for us to build more complex tools, as well as:
* Give Octopus Administrators more granular control over MCP clients
* Natively support remote OAuth rather than authorization via API keys
* Integrate security scanning tools into the MCP output

## License

This project is licensed under the terms of Apache 2.0 open source license.