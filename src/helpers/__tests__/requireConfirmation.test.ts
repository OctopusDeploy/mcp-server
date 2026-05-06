import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { requireConfirmation } from "../requireConfirmation.js";

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

    it("ignores fallbackConfirm when elicitation is used", async () => {
      stub.elicitInput.mockResolvedValue({ action: "decline" });
      const result = await requireConfirmation(makeServer(stub), {
        message: "x",
        fallbackConfirm: true,
      });
      expect(result).toEqual({ confirmed: false, reason: "declined" });
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
