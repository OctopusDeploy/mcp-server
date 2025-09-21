import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type Toolset = 
  | "core" 
  | "projects" 
  | "deployments" 
  | "releases" 
  | "tasks" 
  | "tenants" 
  | "kubernetes"
  | "machines"
  | "context"
  | "certificates"
  | "accounts";

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
  minimumOctopusVersion?: string;
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
  "kubernetes",
  "machines",
  "context",
  "certificates",
  "accounts"
];

export interface ToolVersionInfo {
  toolName: string;
  toolset: Toolset;
  minimumOctopusVersion: string;
}

export interface VersionAnalysis {
  toolsByVersion: Map<string, ToolVersionInfo[]>;
  minimumSupportedVersion: string;
  versionRequiredForAllTools: string;
  allVersions: string[];
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

export function analyzeToolVersions(): VersionAnalysis {
  const toolsByVersion = new Map<string, ToolVersionInfo[]>();
  const allVersions = new Set<string>();

  for (const [toolName, registration] of TOOL_REGISTRY) {
    const version = registration.minimumOctopusVersion || "2021.1";
    allVersions.add(version);

    if (!toolsByVersion.has(version)) {
      toolsByVersion.set(version, []);
    }

    toolsByVersion.get(version)!.push({
      toolName,
      toolset: registration.config.toolset,
      minimumOctopusVersion: version
    });
  }

  const sortedVersions = Array.from(allVersions).sort(compareVersions);
  const minimumSupportedVersion = sortedVersions[0] || "2021.1";
  const versionRequiredForAllTools = sortedVersions[sortedVersions.length - 1] || "2021.1";

  return {
    toolsByVersion,
    minimumSupportedVersion,
    versionRequiredForAllTools,
    allVersions: sortedVersions
  };
}

export function printToolVersionAnalysis(): void {
  const analysis = analyzeToolVersions();

  console.log("=== Octopus Deploy MCP Server - Tool Version Analysis ===\n");

  console.log(`Minimum supported version: ${analysis.minimumSupportedVersion}`);
  console.log(`Version required for all tools: ${analysis.versionRequiredForAllTools}\n`);

  console.log("Tools by Octopus version:");
  for (const version of analysis.allVersions) {
    const tools = analysis.toolsByVersion.get(version)!;
    console.log(`\n${version}:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.toolName} (${tool.toolset})`);
    });
  }

  console.log(`\nTotal tools: ${TOOL_REGISTRY.size}`);
  console.log(`Versions supported: ${analysis.allVersions.join(", ")}`);
}