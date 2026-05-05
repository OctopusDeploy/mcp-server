import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { dispatchOctopusUri } from "../resources/dispatch.js";

export function registerReadResourceTool(server: McpServer) {
  server.registerTool(
    "read_resource",
    {
      title: "Read an Octopus resource by URI",
      description: `Dereference an octopus:// resource URI and return its body.

  Backstop for MCP clients that do not natively support the resources/read primitive.
  Resource-aware clients should call resources/read directly instead of this tool.

  Pass any octopus:// URI returned by another tool (typically the resourceUri field).
  The response 'mimeType' tells you how to interpret 'text': usually 'application/json'
  (parse it) or 'text/markdown' (display as-is).`,
      inputSchema: {
        uri: z
          .string()
          .describe(
            "An octopus:// resource URI returned in the resourceUri field of a tool response.",
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
