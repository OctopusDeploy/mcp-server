import { describe, it, expect, beforeEach, vi } from "vitest";

const get = vi.fn();
const resolveSpaceId = vi.fn();

vi.mock("../../helpers/getClientConfigurationFromEnvironment.js", () => ({
  getClientConfigurationFromEnvironment: () => ({
    instanceURL: "https://octopus.example",
    apiKey: "API-TEST",
  }),
}));

vi.mock("@octopusdeploy/api-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@octopusdeploy/api-client")>();
  return {
    ...actual,
    Client: { create: vi.fn(async () => ({ get })) },
    resolveSpaceId: (...args: unknown[]) => resolveSpaceId(...args),
  };
});

import {
  RESOURCE_REGISTRY,
  type ResourceDescriptor,
} from "../../types/resourceConfig.js";
import { dispatchOctopusUri } from "../dispatch.js";
import "../interruption.js";

function descriptorByName(name: string): ResourceDescriptor {
  const descriptor = RESOURCE_REGISTRY.find((d) => d.name === name);
  if (!descriptor) {
    throw new Error(`Resource descriptor '${name}' is not registered.`);
  }
  return descriptor;
}

const sampleInterruption = {
  Id: "Interruptions-1",
  SpaceId: "Spaces-1",
  Title: "Manual Intervention Required",
  Type: "ManualIntervention",
  IsPending: true,
  TaskId: "ServerTasks-867",
  CorrelationId: "ServerTasks-867_K2CLXQCT9Q/abc/def",
  CanTakeResponsibility: true,
  HasResponsibility: true,
  ResponsibleUserId: "Users-1",
  ResponsibleTeamIds: [],
  RelatedDocumentIds: [
    "Deployments-41",
    "ServerTasks-867",
    "Projects-21",
    "Environments-3",
  ],
  Form: {
    Values: { Instructions: null, Notes: null, Result: null },
    Elements: [
      {
        Name: "Instructions",
        Control: {
          Type: "Paragraph",
          Text: "## Please review",
          ResolveLinks: false,
        },
        IsValueRequired: false,
      },
      {
        Name: "Result",
        Control: {
          Type: "SubmitButtonGroup",
          Buttons: [
            { Text: "Abort", Value: "Abort", ButtonType: "Delete" },
            { Text: "Proceed", Value: "Proceed", ButtonType: "Primary" },
          ],
        },
        IsValueRequired: false,
      },
    ],
  },
  Links: {
    Self: "/api/Spaces-1/interruptions/Interruptions-1",
    Submit: "/api/Spaces-1/interruptions/Interruptions-1/submit",
  },
};

describe("interruption resource", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  describe("octopus://spaces/{spaceName}/interruptions/{interruptionId}", () => {
    const descriptor = () => descriptorByName("interruption");

    it("returns the full interruption body with Form intact and Links stripped", async () => {
      get.mockResolvedValueOnce(sampleInterruption);

      const payload = await descriptor().read({
        spaceName: "Default",
        interruptionId: "Interruptions-1",
      });

      expect(payload.mimeType).toBe("application/json");
      const body = JSON.parse(payload.text);

      // Links stripped.
      expect(body.Links).toBeUndefined();

      // Full Form preserved — this is the whole point of the resource.
      expect(body.Form.Elements).toHaveLength(2);
      expect(body.Form.Elements[0].Name).toBe("Instructions");
      expect(body.Form.Elements[0].Control.Text).toContain("Please review");
      expect(body.Form.Elements[1].Control.Buttons).toEqual([
        { Text: "Abort", Value: "Abort", ButtonType: "Delete" },
        { Text: "Proceed", Value: "Proceed", ButtonType: "Primary" },
      ]);

      // Server-computed responsibility flags preserved.
      expect(body.CanTakeResponsibility).toBe(true);
      expect(body.HasResponsibility).toBe(true);

      // Resolved against the URL template.
      expect(get).toHaveBeenCalledWith(
        "~/api/{spaceId}/interruptions/{interruptionId}",
        { spaceId: "Spaces-1", interruptionId: "Interruptions-1" },
      );
    });

    it("rejects an invalid interruptionId before any API call", async () => {
      await expect(
        descriptor().read({
          spaceName: "Default",
          interruptionId: "not-a-real-id",
        }),
      ).rejects.toThrow(/Invalid interruption ID format/);

      expect(get).not.toHaveBeenCalled();
      expect(resolveSpaceId).not.toHaveBeenCalled();
    });

    it("translates 404 from the api-client into a friendly error", async () => {
      get.mockRejectedValueOnce(new Error("Resource not found (404)"));

      await expect(
        descriptor().read({
          spaceName: "Default",
          interruptionId: "Interruptions-99",
        }),
      ).rejects.toThrow(/not found in space 'Default'/);
    });
  });

  describe("dispatch integration", () => {
    it("routes a URI to the interruption descriptor and URL-decodes spaceName", async () => {
      get.mockResolvedValueOnce(sampleInterruption);

      const payload = await dispatchOctopusUri(
        "octopus://spaces/AI%20Foundations/interruptions/Interruptions-1",
      );

      expect(payload).not.toBeNull();
      expect(payload!.mimeType).toBe("application/json");
      expect(resolveSpaceId).toHaveBeenCalledWith(
        expect.anything(),
        "AI Foundations",
      );
    });
  });
});
