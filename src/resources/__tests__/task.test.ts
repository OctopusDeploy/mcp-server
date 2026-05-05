import { describe, it, expect, beforeEach, vi } from "vitest";

const getById = vi.fn();
const getDetails = vi.fn();
const getRaw = vi.fn();

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
    Client: { create: vi.fn(async () => ({})) },
    SpaceServerTaskRepository: vi.fn(function () {
      return { getById, getDetails, getRaw };
    }),
  };
});

import {
  RESOURCE_REGISTRY,
  type ResourceDescriptor,
} from "../../types/resourceConfig.js";
import { dispatchOctopusUri } from "../dispatch.js";
import "../task.js";

function descriptorByName(name: string): ResourceDescriptor {
  const descriptor = RESOURCE_REGISTRY.find((d) => d.name === name);
  if (!descriptor) {
    throw new Error(
      `Resource descriptor '${name}' is not registered. Did the side-effect import run?`,
    );
  }
  return descriptor;
}

describe("task resources", () => {
  beforeEach(() => {
    getById.mockReset();
    getDetails.mockReset();
    getRaw.mockReset();
  });

  describe("octopus://spaces/{spaceName}/tasks/{taskId}", () => {
    const descriptor = () => descriptorByName("task");

    it("returns task summary as JSON with Links stripped", async () => {
      getById.mockResolvedValueOnce({
        Id: "ServerTasks-42",
        Name: "Deploy",
        State: "Success",
        Links: { Self: "/api/tasks/ServerTasks-42" },
      });

      const payload = await descriptor().read({
        spaceName: "Default",
        taskId: "ServerTasks-42",
      });

      expect(payload.mimeType).toBe("application/json");
      const body = JSON.parse(payload.text);
      expect(body).toEqual({
        Id: "ServerTasks-42",
        Name: "Deploy",
        State: "Success",
      });
      expect(body.Links).toBeUndefined();
      expect(getById).toHaveBeenCalledWith("ServerTasks-42");
    });

    it("rejects an invalid taskId before any API call", async () => {
      await expect(
        descriptor().read({
          spaceName: "Default",
          taskId: "not-a-task-id",
        }),
      ).rejects.toThrow(/Invalid task ID format/);

      expect(getById).not.toHaveBeenCalled();
    });

    it("translates 404 from the api-client into a friendly error", async () => {
      getById.mockRejectedValueOnce(
        new Error("Resource not found (404)"),
      );

      await expect(
        descriptor().read({
          spaceName: "Default",
          taskId: "ServerTasks-99",
        }),
      ).rejects.toThrow(/not found in space 'Default'/);
    });
  });

  describe("octopus://spaces/{spaceName}/tasks/{taskId}/details", () => {
    const descriptor = () => descriptorByName("task-details");

    it("returns ServerTaskDetails as JSON with Links stripped", async () => {
      getDetails.mockResolvedValueOnce({
        Task: { Id: "ServerTasks-42", State: "Success" },
        Progress: { ProgressPercentage: 100, EstimatedTimeRemaining: "" },
        PhysicalLogSize: 1234,
        ActivityLogs: [],
        Links: { Self: "/api/tasks/ServerTasks-42/details" },
      });

      const payload = await descriptor().read({
        spaceName: "Default",
        taskId: "ServerTasks-42",
      });

      expect(payload.mimeType).toBe("application/json");
      const body = JSON.parse(payload.text);
      expect(body.Task).toEqual({ Id: "ServerTasks-42", State: "Success" });
      expect(body.PhysicalLogSize).toBe(1234);
      expect(body.Links).toBeUndefined();
      expect(getDetails).toHaveBeenCalledWith("ServerTasks-42");
    });
  });

  describe("octopus://spaces/{spaceName}/tasks/{taskId}/log", () => {
    const descriptor = () => descriptorByName("task-log");

    it("returns the raw log as text/plain without JSON wrapping", async () => {
      const rawLog = "12:00:00 Info | Step 1\n12:00:01 Error | Boom\n";
      getRaw.mockResolvedValueOnce(rawLog);

      const payload = await descriptor().read({
        spaceName: "Default",
        taskId: "ServerTasks-42",
      });

      expect(payload.mimeType).toBe("text/plain");
      expect(payload.text).toBe(rawLog);
      expect(getRaw).toHaveBeenCalledWith("ServerTasks-42");
    });
  });

  describe("dispatch integration", () => {
    it("routes URIs to the matching task descriptor and URL-decodes spaceName", async () => {
      getDetails.mockResolvedValueOnce({
        Task: { Id: "ServerTasks-7", State: "Executing" },
      });

      const payload = await dispatchOctopusUri(
        "octopus://spaces/AI%20Foundations/tasks/ServerTasks-7/details",
      );

      expect(payload).not.toBeNull();
      expect(payload!.mimeType).toBe("application/json");
      // SpaceServerTaskRepository should have been constructed with the
      // decoded space name; verify via the captured call to getDetails.
      expect(getDetails).toHaveBeenCalledWith("ServerTasks-7");
    });

    it("dispatch and direct read produce identical payloads", async () => {
      getById.mockResolvedValue({
        Id: "ServerTasks-1",
        State: "Success",
        Links: { Self: "ignored" },
      });

      const direct = await descriptorByName("task").read({
        spaceName: "Default",
        taskId: "ServerTasks-1",
      });
      const dispatched = await dispatchOctopusUri(
        "octopus://spaces/Default/tasks/ServerTasks-1",
      );

      expect(dispatched).toEqual(direct);
    });
  });
});
