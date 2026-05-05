import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { dispatchOctopusUri } from "../resources/dispatch.js";

export function registerReadResourceTool(server: McpServer) {
  server.registerTool(
    "read_resource",
    {
      title: "Read an Octopus resource by URI",
      description: `Universal fetch for any 'octopus://' URI returned by any other tool. Use this whenever you see fields like 'resourceUri' or 'taskResourceUri' in a response and need the full body.

How to use:
- Pass the URI string verbatim. Examples: 'octopus://spaces/Default/releases/Releases-42', 'octopus://spaces/Default/tasks/ServerTasks-7', 'octopus://spaces/Default/tasks/ServerTasks-7/details'.
- The response 'mimeType' tells you how to interpret 'text': 'application/json' → parse as JSON.

This tool is the backstop for clients that do not natively implement the MCP 'resources/read' primitive. Clients that DO support resources/read (Claude Code, MCP Inspector) can call it directly and skip this tool. Either path returns byte-identical bodies.

Tools that return resource URIs include: find_releases, get_deployment_from_url, get_task_from_url, and others. When in doubt, call read_resource on any 'octopus://' string you encounter.

Note: there is intentionally no octopus://...tasks/{id}/log resource. Call the grep_task_log tool to search task logs without inhaling the full body.`,
      inputSchema: {
        uri: z
          .string()
          .describe(
            "Any 'octopus://...' URI returned by another tool (e.g. in the resourceUri or taskResourceUri field).",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ uri }) => {
      const payload = await dispatchOctopusUri(uri);

      if (payload === null) {
        throw new Error(`Unrecognised resource URI '${uri}'.`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              uri,
              mimeType: payload.mimeType,
              text: payload.text,
            }),
          },
        ],
      };
    },
  );
}

registerToolDefinition({
  toolName: "read_resource",
  config: { toolset: "core", readOnly: true },
  registerFn: registerReadResourceTool,
});
