import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ToolsetConfig,
  type Toolset,
  DEFAULT_TOOLSETS,
} from "../types/toolConfig.js";
import { RESOURCE_REGISTRY } from "../types/resourceConfig.js";
import { flatten } from "./dispatch.js";
import { setActiveToolsetConfig } from "../helpers/activeToolsetConfig.js";

// Side-effect imports populate RESOURCE_REGISTRY.
import "./release.js";
import "./runbook.js";
import "./task.js";
import "./interruption.js";
import "./catalog/llmsTxt.js";
import "./catalog/capabilities.js";

function isToolsetEnabled(toolset: Toolset, config: ToolsetConfig): boolean {
  const enabled: Toolset[] =
    config.enabledToolsets === "all"
      ? DEFAULT_TOOLSETS
      : config.enabledToolsets || DEFAULT_TOOLSETS;

  return toolset === "core" || enabled.includes(toolset);
}

export function registerResources(server: McpServer, config: ToolsetConfig = {}): void {
  setActiveToolsetConfig(config);
  for (const descriptor of RESOURCE_REGISTRY) {
    if (!isToolsetEnabled(descriptor.toolset, config)) continue;

    server.registerResource(
      descriptor.name,
      new ResourceTemplate(descriptor.uriTemplate, { list: undefined }),
      {
        title: descriptor.title,
        description: descriptor.description,
        mimeType: descriptor.mimeType,
      },
      async (uri, variables) => {
        const payload = await descriptor.read(flatten(variables));
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: payload.mimeType,
              text: payload.text,
            },
          ],
        };
      },
    );
  }
}
