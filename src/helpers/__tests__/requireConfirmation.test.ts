import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  requireConfirmation,
  unconfirmedResponse,
} from "../requireConfirmation.js";

interface ServerStub {
  getClientCapabilities: ReturnType<typeof vi.fn>;
  elicitInput: ReturnType<typeof vi.fn>;
}

function makeServer(stub: ServerStub): McpServer {
  return { server: stub } as unknown as McpServer;
}

describe("requireConfirmation", () => {
  let stub: ServerStub;

  beforeEach(() => {
    stub = {
      getClientCapabilities: vi.fn(),
      elicitInput: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("when OCTOPUS_SKIP_ELICITATION is set to 'true'", () => {
    beforeEach(() => {
      vi.stubEnv("OCTOPUS_SKIP_ELICITATION", "true");
    });

    it("returns confirmed: true with reason 'envSkip'", async () => {
      const result = await requireConfirmation(makeServer(stub), {
        message: "ignored",
      });
      expect(result).toEqual({ confirmed: true, reason: "envSkip" });
    });

    it("short-circuits without consulting capabilities or elicitInput", async () => {
      await requireConfirmation(makeServer(stub), { message: "ignored" });
      expect(stub.getClientCapabilities).not.toHaveBeenCalled();
      expect(stub.elicitInput).not.toHaveBeenCalled();
    });

    it("ignores fallbackConfirm", async () => {
      const result = await requireConfirmation(makeServer(stub), {
        message: "ignored",
        fallbackConfirm: false,
      });
      expect(result).toEqual({ confirmed: true, reason: "envSkip" });
    });
  });

  describe("when OCTOPUS_SKIP_ELICITATION is set to a non-'true' string", () => {
    it.each(["1", "yes", "TRUE", "True", " true ", ""])(
      "does not skip when value is %j",
      async (value) => {
        vi.stubEnv("OCTOPUS_SKIP_ELICITATION", value);
        stub.getClientCapabilities.mockReturnValue(undefined);
        const result = await requireConfirmation(makeServer(stub), {
          message: "x",
          fallbackConfirm: false,
        });
        expect(result).toEqual({ confirmed: false, reason: "declined" });
        expect(stub.getClientCapabilities).toHaveBeenCalledOnce();
      },
    );
  });

  describe("when client advertises elicitation capability", () => {
    beforeEach(() => {
      stub.getClientCapabilities.mockReturnValue({ elicitation: {} });
    });

    it("returns confirmed: true with reason 'accepted' on action 'accept'", async () => {
      stub.elicitInput.mockResolvedValue({ action: "accept" });
      const result = await requireConfirmation(makeServer(stub), {
        message: "Do the thing?",
      });
      expect(result).toEqual({ confirmed: true, reason: "accepted" });
    });

    it("returns confirmed: false with reason 'declined' on action 'decline'", async () => {
      stub.elicitInput.mockResolvedValue({ action: "decline" });
      const result = await requireConfirmation(makeServer(stub), {
        message: "Do the thing?",
      });
      expect(result).toEqual({ confirmed: false, reason: "declined" });
    });

    it("returns confirmed: false with reason 'cancelled' on action 'cancel'", async () => {
      stub.elicitInput.mockResolvedValue({ action: "cancel" });
      const result = await requireConfirmation(makeServer(stub), {
        message: "Do the thing?",
      });
      expect(result).toEqual({ confirmed: false, reason: "cancelled" });
    });

    it("calls elicitInput with the supplied message and an empty-properties schema", async () => {
      stub.elicitInput.mockResolvedValue({ action: "accept" });
      await requireConfirmation(makeServer(stub), {
        message: "Deploy release 1.2.3 to Production?",
      });
      expect(stub.elicitInput).toHaveBeenCalledWith({
        mode: "form",
        message: "Deploy release 1.2.3 to Production?",
        requestedSchema: { type: "object", properties: {} },
      });
    });

    it("renders create-style payloads (empty source) as a JSON object of `+` additions", async () => {
      stub.elicitInput.mockResolvedValue({ action: "accept" });
      await requireConfirmation(makeServer(stub), {
        message: "Deploy release 1.2.3 to Production?",
        change: {
          source: {},
          target: {
            ProjectName: "MyProject",
            ReleaseVersion: "1.2.3",
            EnvironmentNames: ["Production"],
            SkipStepNames: ["Notify"],
          },
        },
      });
      const call = stub.elicitInput.mock.calls[0][0];
      expect(call.message).toBe(
        [
          "Deploy release 1.2.3 to Production?",
          "",
          "{",
          '+  "ProjectName": "MyProject",',
          '+  "ReleaseVersion": "1.2.3",',
          '+  "EnvironmentNames": [',
          '+    "Production"',
          "+  ],",
          '+  "SkipStepNames": [',
          '+    "Notify"',
          "+  ]",
          "}",
        ].join("\n"),
      );
      expect(call.requestedSchema).toEqual({
        type: "object",
        properties: {},
      });
    });

    it("renders modify-style payloads as a JSON diff, omitting unchanged keys", async () => {
      stub.elicitInput.mockResolvedValue({ action: "accept" });
      await requireConfirmation(makeServer(stub), {
        message: "Update environment Production?",
        change: {
          source: {
            Name: "Production",
            Description: "Old",
            AllowDynamicInfrastructure: false,
          },
          target: {
            Name: "Production",
            Description: "New",
            AllowDynamicInfrastructure: true,
          },
        },
      });
      const call = stub.elicitInput.mock.calls[0][0];
      expect(call.message).toBe(
        [
          "Update environment Production?",
          "",
          "{",
          '-  "Description": "Old",',
          '+  "Description": "New",',
          '-  "AllowDynamicInfrastructure": false,',
          '+  "AllowDynamicInfrastructure": true',
          "}",
        ].join("\n"),
      );
      // Unchanged keys are not surfaced.
      expect(call.message).not.toContain('"Name"');
    });

    it("renders source-only keys as `-` removals and target-only keys as `+` additions", async () => {
      stub.elicitInput.mockResolvedValue({ action: "accept" });
      await requireConfirmation(makeServer(stub), {
        message: "Update?",
        change: {
          source: { Removed: "gone" },
          target: { Added: "new" },
        },
      });
      const call = stub.elicitInput.mock.calls[0][0];
      expect(call.message).toBe(
        [
          "Update?",
          "",
          "{",
          '-  "Removed": "gone",',
          '+  "Added": "new"',
          "}",
        ].join("\n"),
      );
    });

    it("renders an empty JSON object when source and target are equal", async () => {
      stub.elicitInput.mockResolvedValue({ action: "accept" });
      await requireConfirmation(makeServer(stub), {
        message: "Update?",
        change: { source: { a: 1 }, target: { a: 1 } },
      });
      const call = stub.elicitInput.mock.calls[0][0];
      expect(call.message).toBe(["Update?", "", "{}"].join("\n"));
    });

    it("does not append a diff when change is omitted", async () => {
      stub.elicitInput.mockResolvedValue({ action: "accept" });
      await requireConfirmation(makeServer(stub), { message: "Plain prompt?" });
      const call = stub.elicitInput.mock.calls[0][0];
      expect(call.message).toBe("Plain prompt?");
    });

    it("honours fallbackConfirm: true before attempting elicitation", async () => {
      // Some clients advertise elicitation capability but cannot actually render
      // a usable prompt (or auto-decline). When the LLM explicitly passes
      // `confirm: true` it's asserting the user approved out-of-band, so we
      // must short-circuit before sending a doomed elicitation request.
      const result = await requireConfirmation(makeServer(stub), {
        message: "x",
        fallbackConfirm: true,
      });
      expect(result).toEqual({ confirmed: true, reason: "fallbackConfirm" });
      expect(stub.elicitInput).not.toHaveBeenCalled();
    });

    it("falls through to elicitation when fallbackConfirm is false", async () => {
      stub.elicitInput.mockResolvedValue({ action: "accept" });
      const result = await requireConfirmation(makeServer(stub), {
        message: "x",
        fallbackConfirm: false,
      });
      expect(result).toEqual({ confirmed: true, reason: "accepted" });
      expect(stub.elicitInput).toHaveBeenCalledOnce();
    });

    it("propagates errors from elicitInput", async () => {
      stub.elicitInput.mockRejectedValue(new Error("transport failure"));
      await expect(
        requireConfirmation(makeServer(stub), { message: "x" }),
      ).rejects.toThrow("transport failure");
    });
  });

  describe("when client does not advertise elicitation capability", () => {
    it.each([
      ["undefined capabilities", undefined],
      ["empty capabilities object", {}],
      ["capabilities without elicitation", { sampling: {} }],
    ])(
      "treats fallbackConfirm: true as 'fallbackConfirm' when %s",
      async (_label, capabilities) => {
        stub.getClientCapabilities.mockReturnValue(capabilities);
        const result = await requireConfirmation(makeServer(stub), {
          message: "x",
          fallbackConfirm: true,
        });
        expect(result).toEqual({ confirmed: true, reason: "fallbackConfirm" });
        expect(stub.elicitInput).not.toHaveBeenCalled();
      },
    );

    it("treats fallbackConfirm: false as 'declined'", async () => {
      stub.getClientCapabilities.mockReturnValue(undefined);
      const result = await requireConfirmation(makeServer(stub), {
        message: "x",
        fallbackConfirm: false,
      });
      expect(result).toEqual({ confirmed: false, reason: "declined" });
    });

    it("treats omitted fallbackConfirm as 'confirmationRequired'", async () => {
      stub.getClientCapabilities.mockReturnValue(undefined);
      const result = await requireConfirmation(makeServer(stub), {
        message: "x",
      });
      expect(result).toEqual({
        confirmed: false,
        reason: "confirmationRequired",
      });
    });

    it("does not call elicitInput on any fallback branch", async () => {
      stub.getClientCapabilities.mockReturnValue(undefined);
      await requireConfirmation(makeServer(stub), {
        message: "x",
        fallbackConfirm: true,
      });
      await requireConfirmation(makeServer(stub), {
        message: "x",
        fallbackConfirm: false,
      });
      await requireConfirmation(makeServer(stub), { message: "x" });
      expect(stub.elicitInput).not.toHaveBeenCalled();
    });
  });
});

describe("unconfirmedResponse", () => {
  function parsePayload(response: { content: Array<{ text: string }> }): {
    success: boolean;
    confirmationRequired?: boolean;
    cancelled?: boolean;
    reason?: string;
    message: string;
  } {
    return JSON.parse(response.content[0].text);
  }

  describe("when reason is 'confirmationRequired'", () => {
    it("returns isError: true", () => {
      const response = unconfirmedResponse(
        { confirmed: false, reason: "confirmationRequired" },
        { action: "release creation" },
      );
      expect(response.isError).toBe(true);
    });

    it("payload sets confirmationRequired: true and embeds the action", () => {
      const response = unconfirmedResponse(
        { confirmed: false, reason: "confirmationRequired" },
        { action: "release creation" },
      );
      const payload = parsePayload(response);
      expect(payload.success).toBe(false);
      expect(payload.confirmationRequired).toBe(true);
      expect(payload.message).toContain("release creation");
      expect(payload.message).toContain("user has NOT been asked");
    });

    it("does not set the cancelled / reason fields", () => {
      const response = unconfirmedResponse(
        { confirmed: false, reason: "confirmationRequired" },
        { action: "deployment" },
      );
      const payload = parsePayload(response);
      expect(payload.cancelled).toBeUndefined();
      expect(payload.reason).toBeUndefined();
    });
  });

  describe("when reason is 'declined' or 'cancelled'", () => {
    it.each(["declined", "cancelled"] as const)(
      "returns soft cancellation shape with reason %s",
      (reason) => {
        const response = unconfirmedResponse(
          { confirmed: false, reason },
          { action: "release creation" },
        );
        expect(response.isError).toBeUndefined();
        const payload = parsePayload(response);
        expect(payload.success).toBe(false);
        expect(payload.cancelled).toBe(true);
        expect(payload.reason).toBe(reason);
        expect(payload.confirmationRequired).toBeUndefined();
      },
    );

    it("capitalizes the action for the cancelled message", () => {
      const response = unconfirmedResponse(
        { confirmed: false, reason: "declined" },
        { action: "deployment" },
      );
      expect(parsePayload(response).message).toBe(
        "Deployment cancelled by user.",
      );
    });
  });
});
