# 🐙 Octopus Deploy Official MCP Server

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) allows the AI assistants you use in your day to day work, like Claude Code, or ChatGPT, to connect to the systems and services you own in a standardized fashion, allowing them to pull information from those systems and services to answer questions and perform tasks.

The Octopus MCP Server provides your AI assistant with powerful tools that allow it to inspect, query, and diagnose problems within your Octopus instance, transforming it into your ultimate devops wingmate. 

This project should currently be considered unstable, and subject to breaking changes. In the future, we may offer stability; please file an issue if there is a use case where this would be valuable.

### Octopus Server Compatibility

The MCP Server is developed and tested against versions `2025.3.x` of Octopus Server. Most of the APIs used are stable and exist in prior versions of Octopus and should therefore be generally compatible but we will not be testing or deliberately maintaining compatibility with older versions of Octopus.

## ⚠️ Security Disclaimer ⚠️

While the Octopus MCP Server at this stage is a read-only tool it **can read full deployment logs, which could include secrets stored in your Octopus Server, such as production keys.** Excercise caution when connecting Octopus MCP to tools and models you do not fully trust.

Running agents in a fully automated fashion could make you vulnerable to exposure via prompt-injection attacks that exfiltrate tokens.

Excercise caution and mitigate the risks by using least-privileged accounts when connecting to Octopus Server.

## 🚀 Installation

```
TBD
```

### Configuration Options

The Octopus MCP Server supports several command-line options to customize which tools are available:

#### Toolsets
Use the `--toolsets` parameter to enable specific groups of tools:

```bash
# Enable all toolsets (default)
npm start

# Enable only specific toolsets
npm start -- --toolsets projects,deployments

# Enable all toolsets explicitly
npm start -- --toolsets all
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
npm start -- --read-only

# Disable read-only mode (currently no effect as all tools are read-only)
npm start -- --read-only=false
```

#### Complete Examples

```bash
# Development setup with only core and project tools
npm start -- --toolsets core,projects --server-url https://your-octopus.com --api-key YOUR_API_KEY

# Full production setup with all tools
npm start -- --toolsets all --read-only --server-url https://your-octopus.com --api-key YOUR_API_KEY
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
  
  This tool lists all projects in a given space. The space name is required, if you can't find the space name, ask the user directly for the name of the space. Optionally filter by partial name match using partialName parameter.

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
<summary>get_latest_deployment</summary>

**Description**: Get details for the latest deployment of a project
    
    This tool finds the most recent deployment for a given project in a space and returns the deployment details along with the server task information.

**Parameters**: 
- `spaceName` (string, required): The space name
- `projectId` (string, required): The ID of the project

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
<summary>get_current_user</summary>

**Description**: Get information about the current authenticated user

This tool retrieves information about the currently authenticated user from the Octopus Deploy API.

**Parameters**: None

</details>

## Contributing

We are keen to hear how you plan to use Octopus MCP server and what features you would like to see us build. You can reach out to our team directly via `TBD`

Alternatively, for issues and feedback please use [Octopus Deploy Issues](https://github.com/OctopusDeploy/Issues/issues) repository.

## FAQ

### Do you have plans to release a remote MCP server?

We are working on integrating an MCP server directly into Octopus Server. This will open up the door for us to build more complex tools, as well as:
* Give Octopus Administrators more granular control over MCP clients
* Natively support remote OAuth rather than authorization via API keys
* Integrate security scanning tools into the MCP output

## License

This project is licensed under the terms of X open source license.