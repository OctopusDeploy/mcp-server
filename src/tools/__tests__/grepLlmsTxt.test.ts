import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchLlmsTxt = vi.fn();

vi.mock("../../resources/catalog/llmsTxt.js", () => ({
  fetchLlmsTxt: (...args: unknown[]) => fetchLlmsTxt(...args),
}));

import { registerGrepLlmsTxtTool } from "../grepLlmsTxt.js";

interface RegisteredTool {
  config: {
    title?: string;
    description?: string;
    inputSchema?: unknown;
    annotations?: unknown;
  };
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
}

function makeServerStub(): {
  server: {
    registerTool: (
      name: string,
      config: RegisteredTool["config"],
      handler: RegisteredTool["handler"],
    ) => void;
  };
  registered: Map<string, RegisteredTool>;
} {
  const registered = new Map<string, RegisteredTool>();
  return {
    server: {
      registerTool(name, config, handler) {
        registered.set(name, { config, handler });
      },
    },
    registered,
  };
}

const SAMPLE_LLMS = [
  "# Octopus Deploy API",
  "",
  "## Endpoints",
  "",
  "### Releases",
  "- `GET /releases` - list releases",
  "- `POST /releases` - create release | Body: CreateReleaseCommand",
  "- `DELETE /releases/{id}` - delete release",
  "",
  "### Channels",
  "- `GET /channels` - list channels",
  "- `POST /channels` - create channel | Body: CreateChannelCommand",
  "- `DELETE /channels/{id}` - delete channel",
  "",
].join("\n");

describe("grep_llms_txt tool handler", () => {
  beforeEach(() => {
    fetchLlmsTxt.mockReset();
    fetchLlmsTxt.mockResolvedValue(SAMPLE_LLMS);
  });

  it("returns line-numbered matches for a literal pattern", async () => {
    const { server, registered } = makeServerStub();
    registerGrepLlmsTxtTool(server as never);
    const tool = registered.get("grep_llms_txt")!;

    const response = await tool.handler({ pattern: "POST /" });

    const result = JSON.parse(response.content[0].text) as {
      totalMatches: number;
      matches: Array<{ lineNumber: number; line: string }>;
      catalogResourceUri: string;
      pattern: string;
    };

    expect(result.totalMatches).toBe(2);
    expect(result.matches.map((m) => m.line)).toEqual([
      "- `POST /releases` - create release | Body: CreateReleaseCommand",
      "- `POST /channels` - create channel | Body: CreateChannelCommand",
    ]);
    expect(result.catalogResourceUri).toBe("octopus://api/llms.txt");
    expect(result.pattern).toBe("POST /");
  });

  it("supports section-heading discovery for the agent", async () => {
    const { server, registered } = makeServerStub();
    registerGrepLlmsTxtTool(server as never);
    const tool = registered.get("grep_llms_txt")!;

    const response = await tool.handler({ pattern: "^### " });
    const result = JSON.parse(response.content[0].text) as {
      matches: Array<{ line: string }>;
    };

    expect(result.matches.map((m) => m.line)).toEqual([
      "### Releases",
      "### Channels",
    ]);
  });

  it("reports truncated:true and the true totalMatches when maxCount is exceeded", async () => {
    const { server, registered } = makeServerStub();
    registerGrepLlmsTxtTool(server as never);
    const tool = registered.get("grep_llms_txt")!;

    // 4 lines start with `- \``; cap at 2.
    const response = await tool.handler({
      pattern: "^- `",
      maxCount: 2,
    });
    const result = JSON.parse(response.content[0].text) as {
      totalMatches: number;
      returnedMatches: number;
      truncated: boolean;
    };

    expect(result.totalMatches).toBe(6);
    expect(result.returnedMatches).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it("calls fetchLlmsTxt exactly once per invocation (cache lives in the resource module)", async () => {
    const { server, registered } = makeServerStub();
    registerGrepLlmsTxtTool(server as never);
    const tool = registered.get("grep_llms_txt")!;

    await tool.handler({ pattern: "GET" });

    expect(fetchLlmsTxt).toHaveBeenCalledTimes(1);
  });

  it("registers as read-only", () => {
    const { server, registered } = makeServerStub();
    registerGrepLlmsTxtTool(server as never);
    const tool = registered.get("grep_llms_txt")!;

    expect(tool.config.annotations).toMatchObject({ readOnlyHint: true });
  });
});
