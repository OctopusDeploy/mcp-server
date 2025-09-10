# 🐙 Octopus Deploy Official MCP Server

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) allows the AI assistants you use in your day to day work, like Claude Code, or ChatGPT, to connect to the systems and services you own in a standardized fashion, allowing them to pull information from those systems and services to answer questions and perform tasks.

The Octopus MCP Server provides your AI assistant with powerful tools that allow it to inspect, query, and diagnose problems within your Octopus instance, transforming it into your ultimate devops wingmate. 

This project should currently be considered unstable, and subject to breaking changes. In the future, we may offer stability; please file an issue if there is a use case where this would be valuable.

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
npm start -- --toolsets core,projects,deployments

# Enable all toolsets explicitly
npm start -- --toolsets all
```

Available toolsets:
- **core** - Basic operations (`list_spaces`)
- **projects** - Project operations (`list_projects`)
- **deployments** - Deployment operations (`list_deployments`, `get_latest_deployment`)
- **releases** - Release management (`get_release_by_id`, `list_releases`, `list_releases_for_project`)
- **tasks** - Task operations (`get_task_by_id`, `get_task_details`, `get_task_raw`)
- **tenants** - Multi-tenancy operations (`list_tenants`, `get_tenant_by_id`, `get_tenant_variables`, `get_missing_tenant_variables`)
- **kubernetes** - Kubernetes operations (`get_kubernetes_live_status`)

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
- `space` (string, required): The space name
- `partialName` (string, optional): Filter by partial name match

</details>

<details>
<summary>list_environments</summary>

**Description**: List environments in a space
  
  This tool lists all environments in a given space. The space name is required. Optionally filter by partial name match using partialName parameter.

**Parameters**: 
- `space` (string, required): The space name
- `partialName` (string, optional): Filter by partial name match

</details>

<details>
<summary>list_deployments</summary>

**Description**: List deployments in a space
  
  This tool lists deployments in a given space. The space name is required. Optional filters include: projects (array of project IDs), environments (array of environment IDs), tenants (array of tenant IDs), channels (array of channel IDs), taskState (one of: Canceled, Cancelling, Executing, Failed, Queued, Success, TimedOut), and take (number of results to return).

**Parameters**: 
- `space` (string, required): The space name
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
- `space` (string, required): The space name
- `projectId` (string, required): The ID of the project

</details>

<details>
<summary>get_release_by_id</summary>

**Description**: Get details for a specific release by its ID

**Parameters**: 
- `space` (string, required): The space name
- `releaseId` (string, required): The ID of the release to retrieve

</details>

<details>
<summary>list_releases</summary>

**Description**: List releases in a space
  
  This tool lists all releases in a given space. The space name is required. Optionally provide skip and take parameters for pagination.

**Parameters**: 
- `space` (string, required): The space name
- `skip` (number, optional): Number of items to skip for pagination
- `take` (number, optional): Number of items to take for pagination

</details>

<details>
<summary>list_releases_for_project</summary>

**Description**: List releases for a specific project
  
  This tool lists all releases for a given project in a space. The space name and project ID are required. Optionally provide skip, take, and searchByVersion parameters.

**Parameters**: 
- `space` (string, required): The space name
- `projectId` (string, required): The ID of the project to list releases for
- `skip` (number, optional): Number of items to skip for pagination
- `take` (number, optional): Number of items to take for pagination
- `searchByVersion` (string, optional): Search releases by version string

</details>

<details>
<summary>get_task_by_id</summary>

**Description**: Get details for a specific server task by its ID

**Parameters**: 
- `space` (string, required): The space name
- `taskId` (string, required): The ID of the task to retrieve

</details>

<details>
<summary>get_task_details</summary>

**Description**: Get detailed information for a specific server task by its ID

**Parameters**: 
- `space` (string, required): The space name
- `taskId` (string, required): The ID of the task to retrieve

</details>

<details>
<summary>get_task_raw</summary>

**Description**: Get raw details for a specific server task by its ID

**Parameters**: 
- `space` (string, required): The space name
- `taskId` (string, required): The ID of the task to retrieve

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