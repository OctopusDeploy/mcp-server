import { type ToolsetConfig, type Toolset, DEFAULT_TOOLSETS } from "../types/toolConfig.js";

export function parseToolsets(toolsetsArg: string | undefined): Toolset[] | "all" {
  if (!toolsetsArg || toolsetsArg === "all") {
    return "all";
  }
  
  const toolsets = toolsetsArg.split(",").map(t => t.trim()) as Toolset[];
  
  // Validate toolsets
  const validToolsets = DEFAULT_TOOLSETS;
  const invalidToolsets = toolsets.filter(t => !validToolsets.includes(t));
  
  if (invalidToolsets.length > 0) {
    throw new Error(`Invalid toolsets: ${invalidToolsets.join(", ")}. Valid toolsets are: ${validToolsets.join(", ")}`);
  }
  
  return toolsets;
}

export function createToolsetConfig(
  toolsetsArg: string | undefined,
  readOnlyArg: boolean | undefined
): ToolsetConfig {
  return {
    enabledToolsets: parseToolsets(toolsetsArg),
    readOnlyMode: readOnlyArg ?? true // Default to read-only mode
  };
}