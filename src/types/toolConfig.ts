import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type Toolset = 
  | "core" 
  | "projects" 
  | "deployments" 
  | "releases" 
  | "tasks" 
  | "tenants" 
  | "kubernetes";

export interface ToolConfig {
  toolset: Toolset;
  readOnly: boolean;
}

export interface ToolsetConfig {
  enabledToolsets?: Toolset[] | "all";
  readOnlyMode?: boolean;
}

export interface ToolRegistration {
  toolName: string;
  config: ToolConfig;
  registerFn: (server: McpServer) => void;
}

export const TOOL_REGISTRY: Map<string, ToolRegistration> = new Map();

export function registerToolDefinition(registration: ToolRegistration) {
  TOOL_REGISTRY.set(registration.toolName, registration);
}

export const DEFAULT_TOOLSETS: Toolset[] = [
  "core",
  "projects", 
  "deployments",
  "releases",
  "tasks",
  "tenants",
  "kubernetes"
];