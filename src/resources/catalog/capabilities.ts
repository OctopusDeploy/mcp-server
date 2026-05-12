import { Client } from "@octopusdeploy/api-client";
import { registerResourceDescriptor } from "../../types/resourceConfig.js";
import { getClientConfigurationFromEnvironment } from "../../helpers/getClientConfigurationFromEnvironment.js";
import {
  TOOL_REGISTRY,
  DEFAULT_TOOLSETS,
  type Toolset,
} from "../../types/toolConfig.js";
import { getActiveToolsetConfig } from "../../helpers/activeToolsetConfig.js";
import { type MethodTier } from "../../helpers/methodTier.js";
import { isToolEnabled } from "../../tools/index.js";

interface CapabilityToolEntry {
  name: string;
  toolset: Toolset;
  readOnly: boolean;
  minimumOctopusVersion?: string;
  /**
   * True for tools whose actual read/write/delete behaviour depends on
   * arguments rather than a static tool-level flag. Currently set only on
   * `execute`, where the HTTP method is the runtime classifier.
   */
  methodGated?: boolean;
  /**
   * Effective method tiers reachable through this tool in the *current*
   * session. For `execute` this reflects --read-only and --allow-deletes;
   * for static tools it is undefined (the `readOnly` flag is sufficient).
   */
  tiersAvailable?: MethodTier[];
}

interface Capabilities {
  server: {
    version: string;
    installationId: string;
  };
  session: {
    enabledToolsets: Toolset[];
    readOnlyMode: boolean;
    allowDeletes: boolean;
  };
  tools: CapabilityToolEntry[];
  featureFlags?: unknown;
}

function resolveEnabledToolsets(): Toolset[] {
  const config = getActiveToolsetConfig();
  if (config.enabledToolsets === "all" || config.enabledToolsets == null) {
    return DEFAULT_TOOLSETS;
  }
  return config.enabledToolsets;
}

export async function buildCapabilities(): Promise<Capabilities> {
  const client = await Client.create(getClientConfigurationFromEnvironment());

  const serverInfo = await client.getServerInformation();

  const activeConfig = getActiveToolsetConfig();
  const enabledToolsets = resolveEnabledToolsets();
  const readOnlyMode = activeConfig.readOnlyMode ?? false;
  const allowDeletes = activeConfig.allowDeletes ?? false;

  const enabledSet = new Set<Toolset>(enabledToolsets);
  enabledSet.add("core");

  const tools: CapabilityToolEntry[] = [];
  for (const [name, registration] of TOOL_REGISTRY) {
    // Single source of truth: the catalog lists exactly the tools that
    // `registerTools` would register for this session. Any future filter
    // rule (new tier flag, dynamic toolset gate, etc.) reaches the catalog
    // automatically — which is the class of bug this file just fixed.
    if (!isToolEnabled(registration, activeConfig)) continue;
    const entry: CapabilityToolEntry = {
      name,
      toolset: registration.config.toolset,
      readOnly: registration.config.readOnly,
      minimumOctopusVersion: registration.minimumOctopusVersion,
    };
    if (registration.config.methodGated) {
      entry.methodGated = true;
      const tiers: MethodTier[] = ["read"];
      if (!readOnlyMode) tiers.push("write");
      if (!readOnlyMode && allowDeletes) tiers.push("delete");
      entry.tiersAvailable = tiers;
    }
    tools.push(entry);
  }
  tools.sort((a, b) => a.name.localeCompare(b.name));

  let featureFlags: unknown;
  try {
    featureFlags = await client.get<unknown>("~/api/serverstatus/extensions");
  } catch {
    // The serverstatus/extensions endpoint isn't universally available across
    // older Octopus versions. Omit feature flags rather than failing the whole
    // capabilities read — server version is the high-value field.
    featureFlags = undefined;
  }

  const capabilities: Capabilities = {
    server: {
      version: serverInfo.version,
      installationId: serverInfo.installationId,
    },
    session: {
      enabledToolsets: Array.from(enabledSet).sort() as Toolset[],
      readOnlyMode,
      allowDeletes,
    },
    tools,
  };
  if (featureFlags !== undefined) {
    capabilities.featureFlags = featureFlags;
  }
  return capabilities;
}

registerResourceDescriptor({
  name: "catalog-capabilities",
  uriTemplate: "octopus://api/capabilities",
  toolset: "core",
  title: "Octopus MCP capabilities",
  description:
    "Server version, enabled toolsets, available tools, and Octopus feature flags for this MCP session. Use this to discover what's reachable before calling other tools.",
  mimeType: "application/json",
  read: async () => ({
    mimeType: "application/json",
    text: JSON.stringify(await buildCapabilities()),
  }),
});
