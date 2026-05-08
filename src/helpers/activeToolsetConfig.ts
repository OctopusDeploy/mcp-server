import { type ToolsetConfig } from "../types/toolConfig.js";

/**
 * Per-session ToolsetConfig holder.
 *
 * Resource handlers and the `execute` tool both register eagerly via
 * side-effect imports, so they don't have access to the per-session config
 * at module-eval time. registerResources writes the active config here at
 * startup; the catalog/capabilities resource and execute tool read it on
 * demand.
 */

let activeConfig: ToolsetConfig = {};

export function setActiveToolsetConfig(config: ToolsetConfig): void {
  activeConfig = config;
}

export function getActiveToolsetConfig(): ToolsetConfig {
  return activeConfig;
}
