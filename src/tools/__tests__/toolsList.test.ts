import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createRequire } from "node:module";

import { registerTools } from "../index.js";
import { TOOL_REGISTRY } from "../../types/toolConfig.js";

/**
 * `tools/list` is the first call every MCP client makes after `initialize`. If
 * it throws, the whole server is dead on arrival — no tool is reachable, and
 * the client only sees an opaque `-32603`.
 *
 * It regressed exactly that way once: six tools publish a full `z.object(...)`
 * as their `inputSchema` (see the "SDK workaround" comments on find_releases,
 * find_runbooks, find_interruptions, find_events, update_feature_toggle and
 * run_runbook), and @modelcontextprotocol/sdk below 1.22.0 mistook that
 * ZodObject instance for a raw shape. It re-wrapped it with `z.object(...)`,
 * pulling the instance's own internals — including the `_cached: null` field
 * every v3 ZodObject carries — into the shape, and the JSON Schema conversion
 * then died on `null._def`.
 */
describe("tools/list — end-to-end over a real MCP transport", () => {
  async function listTools() {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server, { enabledToolsets: "all" });

    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    try {
      return (await client.listTools()).tools;
    } finally {
      await client.close();
      await server.close();
    }
  }

  it("returns every registered tool without throwing", async () => {
    const tools = await listTools();
    expect(tools).toHaveLength(TOOL_REGISTRY.size);
  });

  it("publishes a usable object schema for every tool", async () => {
    const tools = await listTools();

    for (const tool of tools) {
      expect(tool.inputSchema, `${tool.name} has no inputSchema`).toBeDefined();
      expect(tool.inputSchema.type, `${tool.name} is not an object schema`).toBe(
        "object",
      );
    }
  });

  it("does not leak Zod instance internals into any published schema", async () => {
    const tools = await listTools();

    // `_cached`, `_def`, `spa` and friends only appear as schema properties
    // when a ZodObject instance was mistakenly spread as a raw shape.
    for (const tool of tools) {
      const properties = Object.keys(tool.inputSchema.properties ?? {});
      const internals = properties.filter((key) => key.startsWith("_"));
      expect(internals, `${tool.name} leaked Zod internals`).toEqual([]);
    }
  });

  it("keeps the declared fields of tools that publish a full ZodObject", async () => {
    const tools = await listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    // These are the six tools that pass a ZodObject rather than a raw shape.
    // A collapse to `{}` here means clients lose all field types and the LLM
    // starts stringifying arrays, booleans and numbers.
    const expectedFields: Record<string, string[]> = {
      find_releases: ["spaceName", "releaseId", "projectId", "searchByVersion"],
      find_runbooks: ["spaceName"],
      find_interruptions: ["spaceName"],
      find_events: ["spaceName", "regarding", "eventCategories"],
      update_feature_toggle: ["spaceName", "projectId"],
      run_runbook: ["spaceName", "projectName", "runbookName", "environmentNames"],
    };

    for (const [name, fields] of Object.entries(expectedFields)) {
      const tool = byName.get(name);
      expect(tool, `${name} was not registered`).toBeDefined();
      const properties = Object.keys(tool!.inputSchema.properties ?? {});
      for (const field of fields) {
        expect(properties, `${name} is missing ${field}`).toContain(field);
      }
    }
  });
});

describe("@modelcontextprotocol/sdk version floor", () => {
  it("requires at least 1.22.0, the first release that accepts a ZodObject inputSchema", () => {
    const require = createRequire(import.meta.url);
    const { dependencies } = require("../../../package.json") as {
      dependencies: Record<string, string>;
    };

    const range = dependencies["@modelcontextprotocol/sdk"];
    const floor = range.replace(/^[^\d]*/, "");
    const [major, minor] = floor.split(".").map(Number);

    // Below 1.22.0 the server cannot answer tools/list at all — see the
    // comment on the suite above. The caret range must not reach back into
    // those releases.
    expect(major).toBe(1);
    expect(minor).toBeGreaterThanOrEqual(22);
  });
});
