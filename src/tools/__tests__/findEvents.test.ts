import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

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
  findEventsHandler,
  findEventsInputSchema,
  findEventsValidationSchema,
  type FindEventsParams,
} from "../findEvents.js";
import { parseToolResponse } from "./testSetup.js";

/**
 * The MCP SDK at 1.29 publishes the inputSchema by reading `.shape` off the
 * passed Zod schema. If `findEventsInputSchema` regresses to a refined
 * ZodEffects wrapper (e.g. someone re-applies `.superRefine` directly to the
 * exported schema once the upstream fix lands prematurely), `.shape` will go
 * away and clients will see an empty schema. These tests guard against that.
 */
describe("find_events — published inputSchema shape (SDK workaround guard)", () => {
  it("exposes a Zod object .shape directly (no ZodEffects wrapper)", () => {
    expect(findEventsInputSchema).toBeInstanceOf(z.ZodObject);
    expect(findEventsInputSchema.shape).toBeDefined();
  });

  it("declares the typed fields a client needs to know about", () => {
    const shape = findEventsInputSchema.shape;
    // String / enum / boolean / number scalars
    expect(shape.spaceName).toBeInstanceOf(z.ZodOptional);
    expect(shape.eventId).toBeInstanceOf(z.ZodOptional);
    expect(shape.from).toBeInstanceOf(z.ZodOptional);
    expect(shape.to).toBeInstanceOf(z.ZodOptional);
    expect(shape.includeInternalEvents).toBeInstanceOf(z.ZodOptional);
    expect(shape.excludeDifference).toBeInstanceOf(z.ZodOptional);
    expect(shape.skip).toBeInstanceOf(z.ZodOptional);
    expect(shape.take).toBeInstanceOf(z.ZodOptional);
    expect(shape.mode).toBeInstanceOf(z.ZodOptional);

    // Array-typed filters — the type that breaks worst when the schema
    // collapses (MCP clients otherwise stringify them).
    for (const arrayField of [
      "regarding",
      "regardingAny",
      "users",
      "projects",
      "environments",
      "tenants",
      "projectGroups",
      "eventCategories",
      "eventGroups",
      "eventAgents",
      "documentTypes",
      "tags",
    ]) {
      const field = shape[arrayField as keyof typeof shape];
      expect(field, `missing field: ${arrayField}`).toBeInstanceOf(
        z.ZodOptional,
      );
      // Unwrap the optional to confirm the inner type is an array of strings.
      const inner = (field as z.ZodOptional<z.ZodArray<z.ZodString>>)._def
        .innerType;
      expect(inner, `${arrayField} inner type`).toBeInstanceOf(z.ZodArray);
    }
  });

  it("includeInternalEvents and excludeDifference are typed as booleans (not strings)", () => {
    const shape = findEventsInputSchema.shape;
    const include = (shape.includeInternalEvents as z.ZodOptional<z.ZodBoolean>)
      ._def.innerType;
    const exclude = (shape.excludeDifference as z.ZodOptional<z.ZodBoolean>)
      ._def.innerType;
    expect(include).toBeInstanceOf(z.ZodBoolean);
    expect(exclude).toBeInstanceOf(z.ZodBoolean);
  });

  it("take and skip are typed as numbers (not strings)", () => {
    const shape = findEventsInputSchema.shape;
    const take = (shape.take as z.ZodOptional<z.ZodNumber>)._def.innerType;
    const skip = (shape.skip as z.ZodOptional<z.ZodNumber>)._def.innerType;
    expect(take).toBeInstanceOf(z.ZodNumber);
    expect(skip).toBeInstanceOf(z.ZodNumber);
  });
});

describe("find_events — cross-field validation", () => {
  it("rejects search mode with no spaceName", () => {
    const result = findEventsValidationSchema.safeParse({ mode: "search" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.path[0] === "spaceName" && i.message.includes("required"),
        ),
      ).toBe(true);
    }
  });

  it("accepts search mode with spaceName and no filters", () => {
    const result = findEventsValidationSchema.safeParse({
      spaceName: "Default",
    });
    expect(result.success).toBe(true);
  });

  it("rejects eventId combined with list filters", () => {
    const result = findEventsValidationSchema.safeParse({
      spaceName: "Default",
      eventId: "Events-123",
      eventGroups: ["Deployment"],
      take: 10,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("eventGroups");
      expect(paths).toContain("take");
    }
  });

  it("accepts eventId combined with excludeDifference (still honoured) and includeInternalEvents (no-op)", () => {
    const result = findEventsValidationSchema.safeParse({
      spaceName: "Default",
      eventId: "Events-123",
      excludeDifference: true,
      includeInternalEvents: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects metadata modes when search filters are supplied", () => {
    const result = findEventsValidationSchema.safeParse({
      mode: "listCategories",
      eventGroups: ["Deployment"],
      take: 5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("eventGroups");
      expect(paths).toContain("take");
    }
  });

  it("accepts metadata modes with no other arguments", () => {
    for (const mode of [
      "listCategories",
      "listGroups",
      "listAgents",
      "listDocumentTypes",
    ] as const) {
      const result = findEventsValidationSchema.safeParse({ mode });
      expect(result.success, `${mode} should validate`).toBe(true);
    }
  });

  it("metadata modes ignore spaceName (allowed but harmless)", () => {
    const result = findEventsValidationSchema.safeParse({
      mode: "listGroups",
      spaceName: "Default",
    });
    expect(result.success).toBe(true);
  });
});

describe("find_events handler — search path passes typed filters through to client.get", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("forwards arrays, booleans, and numbers in their native JS types (not stringified)", async () => {
    get.mockResolvedValueOnce({
      TotalResults: 0,
      ItemsPerPage: 30,
      NumberOfPages: 0,
      LastPageNumber: 0,
      Items: [],
    });

    const params: FindEventsParams = {
      spaceName: "Default",
      eventGroups: ["Deployment", "Modified"],
      projects: ["Projects-1"],
      take: 10,
      skip: 0,
      excludeDifference: true,
      includeInternalEvents: false,
    };

    await findEventsHandler(params);

    expect(get).toHaveBeenCalledTimes(1);
    const callArgs = get.mock.calls[0]?.[1] as Record<string, unknown>;

    // Critical: arrays stay as arrays, not JSON-stringified.
    expect(callArgs.eventGroups).toEqual(["Deployment", "Modified"]);
    expect(Array.isArray(callArgs.eventGroups)).toBe(true);
    expect(callArgs.projects).toEqual(["Projects-1"]);

    // Booleans stay as booleans, numbers stay as numbers.
    expect(callArgs.excludeDifference).toBe(true);
    expect(callArgs.includeInternalEvents).toBe(false);
    expect(callArgs.take).toBe(10);
    expect(callArgs.skip).toBe(0);

    // spaceId substituted from resolveSpaceId.
    expect(callArgs.spaceId).toBe("Spaces-1");
  });

  it("excludeDifference strips ChangeDetails from list items", async () => {
    get.mockResolvedValueOnce({
      TotalResults: 1,
      ItemsPerPage: 30,
      NumberOfPages: 1,
      LastPageNumber: 0,
      Items: [
        {
          Id: "Events-1",
          Message: "Deployment succeeded",
          Category: "DeploymentSucceeded",
          Occurred: "2026-05-13T00:00:00Z",
          UserId: "Users-1",
          Username: "admin",
          IsService: false,
          IdentityEstablishedWith: "ApiKey",
          UserAgent: "curl/8.15.0",
          RelatedDocumentIds: ["Deployments-1"],
          MessageHtml: "",
          MessageReferences: [],
          Comments: null,
          Details: null,
          ChangeDetails: { DocumentContext: "big", Differences: "huge", DocumentVersion: "1" },
          IpAddress: "::1",
          SpaceId: "Spaces-1",
        },
      ],
    });

    const response = await findEventsHandler({
      spaceName: "Default",
      excludeDifference: true,
    });

    const parsed = parseToolResponse<{ items: Array<Record<string, unknown>> }>(
      response,
    );
    expect(parsed.items[0]).toBeDefined();
    expect(parsed.items[0].ChangeDetails).toBeUndefined();
    // Other fields still present.
    expect(parsed.items[0].Id).toBe("Events-1");
    expect(parsed.items[0].Category).toBe("DeploymentSucceeded");
  });

  it("single-eventId path hits the by-id endpoint, not the list endpoint", async () => {
    get.mockResolvedValueOnce({
      Id: "Events-42",
      Message: "Single fetch",
      Category: "ReleaseCreated",
      Occurred: "2026-05-13T00:00:00Z",
      UserId: "Users-1",
      Username: "admin",
      IsService: false,
      IdentityEstablishedWith: "ApiKey",
      UserAgent: "curl/8.15.0",
      RelatedDocumentIds: [],
      MessageHtml: "",
      MessageReferences: [],
      Comments: null,
      Details: null,
      IpAddress: "::1",
      SpaceId: "Spaces-1",
    });

    const response = await findEventsHandler({
      spaceName: "Default",
      eventId: "Events-42",
    });

    expect(get).toHaveBeenCalledTimes(1);
    const [path, args] = get.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toContain("/events/{id}");
    expect(path).not.toContain("{?");
    expect(args.id).toBe("Events-42");

    const parsed = parseToolResponse<Record<string, unknown>>(response);
    // Single fetch returns the event directly, not a pagination wrapper.
    expect(parsed.Id).toBe("Events-42");
    expect((parsed as { items?: unknown }).items).toBeUndefined();
  });

  it("metadata mode hits the unscoped endpoint and returns mode + items", async () => {
    get.mockResolvedValueOnce([
      { Id: "Group-1", Name: "Created" },
      { Id: "Group-2", Name: "Deleted" },
    ]);

    const response = await findEventsHandler({ mode: "listGroups" });

    expect(get).toHaveBeenCalledTimes(1);
    const [path] = get.mock.calls[0] as [string];
    expect(path).toBe("~/api/events/groups");
    // resolveSpaceId is not called for metadata modes (no spaceName needed).
    expect(resolveSpaceId).not.toHaveBeenCalled();

    const parsed = parseToolResponse<{
      mode: string;
      items: Array<{ Id: string }>;
    }>(response);
    expect(parsed.mode).toBe("listGroups");
    expect(parsed.items).toHaveLength(2);
  });
});
