# Working with Octopus Deploy URLs

The Octopus MCP Server provides powerful URL-based tools that allow you to investigate deployments and tasks by simply pasting URLs from your browser. This makes troubleshooting faster and more intuitive by eliminating manual ID extraction.

## Quick Start

**Investigating a failed deployment?** Use the two-step workflow:

```
User: "Why did this deployment fail? https://your-octopus.com/app#/Spaces-1/projects/my-app/deployments/releases/1.0.0/deployments/Deployments-123"

AI: I'll investigate the deployment failure for you.
[Step 1: Uses get_deployment_from_url to get deployment details and taskId]
[Step 2: Uses get_task_details with the taskId to get execution logs]
[Analyzes the task logs and identifies the root cause]
```

**Task URL investigation** is even simpler:

```
User: "What happened with this task? https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456"

AI: I'll check the task details.
[Uses get_task_from_url to get task details and logs directly]
[Analyzes execution and reports results]
```

## URL Anatomy

### Deployment URL Structure

```
https://your-octopus.com/app#/Spaces-1/projects/my-app/deployments/releases/1.0.0/deployments/Deployments-123
                               └────┬───┘         └─┬──┘             └────┬────┘           └────────┬────────┘
                                Space ID       Project Slug        Release Version         Deployment ID
```

**Key components:**
- **Space ID**: `Spaces-1` (automatically resolved to space name)
- **Project Slug**: `my-app` (human-readable project identifier)
- **Release Version**: `1.0.0` (the version being deployed)
- **Deployment ID**: `Deployments-123` (unique deployment identifier)

### Task URL Structure

```
https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456
                               └────┬───┘        └──────┬──────┘
                                Space ID          Task ID
```

**Key components:**
- **Space ID**: `Spaces-1` (automatically resolved to space name)
- **Task ID**: `ServerTasks-456` (unique task identifier)

## Resource Relationships

Understanding how Octopus resources relate to each other is crucial for effective troubleshooting:

```
┌─────────────┐
│ Deployment  │  Contains deployment configuration, environment,
│             │  release version, and a reference to its task
└──────┬──────┘
       │ TaskId
       │
       ▼
┌─────────────┐
│    Task     │  Contains execution details, logs, state,
│             │  and actual deployment results
└─────────────┘
```

**Important:** Deployment URLs don't directly contain task IDs. The MCP server automatically resolves the deployment to find its associated task.

## Available Tools

### `get_deployment_from_url`

**Purpose:** Get deployment details from a deployment URL. **Use this as the first step when investigating deployment issues.**

**Accepts:**
- Deployment URLs only: `https://your-octopus.com/app#/.../deployments/Deployments-123`

**Use when:**
- You need deployment context (environment, release version, project)
- You want to see deployment configuration
- You're starting a deployment investigation (to get the task ID)

**Input:**
```json
{
  "url": "https://your-octopus.com/app#/Spaces-1/projects/my-app/deployments/releases/1.0.0/deployments/Deployments-123"
}
```

**Returns:**
```json
{
  "deployment": {
    "id": "Deployments-123",
    "environmentId": "Environments-1",
    "releaseVersion": "1.0.0",
    "taskId": "ServerTasks-456",
    ...
  },
  "taskIdForLogs": "ServerTasks-456",
  "resolvedSpaceName": "Production",
  "nextSteps": {
    "suggestedTool": "get_task_details",
    "useTaskId": "ServerTasks-456"
  }
}
```

### `get_task_from_url`

**Purpose:** Get task details and logs from a task URL. **Use this to view execution logs when you have a task URL.**

**Accepts:**
- Task URLs only: `https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456`
- For deployment URLs, use `get_deployment_from_url` first

**Use when:**
- You have a direct task URL
- Investigating task execution details
- Following up after getting a taskId from get_deployment_from_url

**Input:**
```json
{
  "url": "https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456"
}
```

**Returns:**
```json
{
  "task": {
    "Id": "ServerTasks-456",
    "Name": "Deploy to Production",
    "State": "Failed",
    "ActivityLogs": [...],
    ...
  },
  "resolvedSpaceName": "Production",
  "resolvedTaskId": "ServerTasks-456"
}
```

## Common Workflows

### Investigating Failed Deployment (Deployment URL)

**Old approach (4+ tool calls):**
```
1. list_spaces → find space name
2. list_deployments → find deployment
3. Extract TaskId from deployment
4. get_task_details → view logs
```

**New approach (2 tool calls):**
```
Step 1: get_deployment_from_url with deployment URL
        → Returns deployment details + taskIdForLogs

Step 2: get_task_details with spaceName and taskIdForLogs
        → Returns task execution logs
```

**Example:**
```
User: "This deployment failed: https://your-octopus.com/app#/Spaces-1/projects/api/deployments/releases/2.1.0/deployments/Deployments-789"

AI Workflow:
Step 1: get_deployment_from_url
  ✓ Extracts Space ID (Spaces-1) and resolves to "Production"
  ✓ Extracts Deployment ID (Deployments-789)
  ✓ Fetches deployment details
  ✓ Returns: Environment "Production", Release "2.1.0", taskIdForLogs: "ServerTasks-456"

Step 2: get_task_details
  ✓ Uses spaceName="Production" and taskId="ServerTasks-456"
  ✓ Fetches task execution logs
  ✓ Analyzes failure: "Connection timeout to database server"
```

### Investigating Task Directly (Task URL)

**When you have a task URL, it's even simpler:**

```
Single tool call: get_task_from_url with task URL
→ Returns task details with logs immediately
```

**Example:**
```
User: "Check this task: https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456"

AI uses get_task_from_url:
✓ Extracts Space ID and resolves to "Production"
✓ Extracts Task ID (ServerTasks-456)
✓ Fetches task details with logs
✓ Reports status: "Task completed successfully in 2m 34s"
```

### Viewing Deployment Details Only

**Use case:** You only need deployment context, not execution logs.

```
User: "What environment was this deployed to? https://your-octopus.com/app#/.../deployments/Deployments-456"

AI uses get_deployment_from_url:
✓ Returns: Environment "Production", Release "1.5.0", queued 2 hours ago
✓ Includes taskIdForLogs if user wants to see execution details later
```

### Full Investigation Workflow

**When investigating a deployment issue, always use the two-step approach:**

```
Step 1: get_deployment_from_url
  Purpose: Get deployment context
  Returns: Environment, release, project, taskIdForLogs

Step 2: get_task_details
  Purpose: Get execution logs and diagnose issues
  Input: spaceName and taskId from Step 1
  Returns: Task state, logs, error messages
```

This separation provides:
- **Clear context first**: Understand what was deployed and where
- **Detailed logs second**: Dive into execution details if needed
- **Predictable behavior**: Each tool does exactly what its name suggests

## Common Pitfalls

### ❌ Trying to Use Task URL Tool with Deployment URL

**Wrong:**
```
get_task_from_url with deployment URL
→ Error: Could not extract task ID from URL
```

**Right:**
```
get_deployment_from_url with deployment URL
→ Get taskIdForLogs
→ Use get_task_details with spaceName and taskId
```

### ❌ Assuming Deployment URLs Contain Task IDs

**Wrong:**
```
Parse deployment URL to extract TaskId directly
→ Task IDs are NOT in deployment URLs
```

**Right:**
```
Step 1: get_deployment_from_url → returns taskIdForLogs
Step 2: get_task_details with the taskId → get logs
```

### ❌ Using Space IDs Instead of Space Names

**Wrong:**
```
get_task_details({
  spaceName: "Spaces-1",  // ❌ This is a space ID
  taskId: "ServerTasks-456"
})
```

**Right:**
```
get_task_from_url({
  url: "https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456"
})
// ✓ Automatically resolves "Spaces-1" to the actual space name
```

### ❌ Manual URL Parsing

**Wrong:**
```
1. Parse URL manually
2. Extract IDs with regex
3. Call multiple tools to resolve IDs
```

**Right:**
```
Use get_task_from_url or get_deployment_from_url
// ✓ All parsing and resolution handled automatically
```

### ❌ Using list_deployments for Single Deployment

**Wrong (slow for large instances):**
```
list_deployments({ spaceName: "Production" })
→ Returns thousands of deployments
→ Filter to find Deployments-123
```

**Right (fast direct lookup):**
```
get_deployment_from_url({ url: "..." })
→ Direct fetch, <2 seconds
```

## Tool Comparison

| Feature | `get_deployment_from_url` | `get_task_from_url` |
|---------|---------------------------|---------------------|
| **Accepts deployment URLs** | ✅ Yes | ❌ No - use get_deployment_from_url first |
| **Accepts task URLs** | ❌ No | ✅ Yes |
| **Returns deployment details** | ✅ Yes | ❌ No |
| **Returns task logs** | ❌ No | ✅ Yes |
| **Returns taskId** | ✅ Yes (for follow-up) | ✅ Yes (resolved from URL) |
| **Space resolution** | ✅ Automatic | ✅ Automatic |
| **Performance** | Direct fetch (<2s) | Direct fetch (<2s) |
| **Primary use case** | Get deployment context | Get task execution logs |
| **Typical position** | Step 1 (for deployments) | Step 1 (for tasks) or Step 2 (after deployment) |

## Best Practices

### 1. Use the Right Tool for the URL Type

- **Deployment URL** → Start with `get_deployment_from_url`
- **Task URL** → Use `get_task_from_url` directly

Each tool accepts only its matching URL type. This makes behavior predictable and errors clear.

### 2. Follow the Two-Step Workflow for Deployment Investigations

When investigating deployment failures:

```
1. get_deployment_from_url → Get context + taskId
2. get_task_details → Get execution logs
```

This provides both context and details in a structured way.

### 3. Use get_deployment_from_url for Context Only

When you only need to know "what was deployed where", you can stop after step 1. You don't always need the execution logs.

### 4. Let the Tools Handle Resolution

Don't manually extract IDs or resolve spaces. The URL tools handle:
- Space ID → space name resolution
- URL parsing and validation
- ID format validation

### 5. Trust the Error Messages

The tools provide actionable error messages:
```
"Could not extract task ID from URL. URL must contain a task identifier (ServerTasks-XXXXX).
If you have a deployment URL, use get_deployment_from_url first to get the task ID,
then use get_task_details to view task logs."
```

## Environment Variables for Testing

When running integration tests, set these environment variables:

```bash
# Required for all tests
OCTOPUS_SERVER_URL=https://your-octopus.com
OCTOPUS_API_KEY=API-XXXXX

# Optional - for URL tool tests
TEST_DEPLOYMENT_URL=https://your-octopus.com/app#/.../deployments/Deployments-123
TEST_TASK_URL=https://your-octopus.com/app#/Spaces-1/tasks/ServerTasks-456
TEST_SPACE_NAME=Default
```

## Performance Notes

**Optimization applied:**
- Both URL tools use direct `.get()` lookups (O(1) complexity)
- No list operations that fetch thousands of records
- Deployment/task queries complete in <2 seconds even for large instances

**Design benefits:**
- Each tool does one thing well (single responsibility)
- Predictable performance regardless of instance size
- Clear separation makes caching strategies simpler

## Example Prompts

### Investigating Failures
```
"Why did this deployment fail?"
"What went wrong with [deployment URL]?"
"Analyze the logs for [task URL]"
```

### Getting Context
```
"What environment was this deployed to?"
"When was [deployment URL] executed?"
"Show me details for this deployment"
```

### Following Workflows
```
"Check all recent deployments to Production and investigate any failures"
"Look at the last 5 deployments and tell me their status"
```

The AI will automatically choose the right tools based on context.
