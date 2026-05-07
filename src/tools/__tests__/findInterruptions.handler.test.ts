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

vi.mock("../../helpers/userCache.js", () => ({
  getCurrentUserCached: vi.fn(async () => ({ Id: "Users-42" })),
  clearUserCache: vi.fn(),
}));

import {
  findInterruptionsHandler,
  ASSIGNED_SCAN_PAGE_SIZE,
  ASSIGNED_SCAN_MAX,
} from "../findInterruptions.js";
import { parseToolResponse } from "./testSetup.js";

interface AssignedWrapper {
  totalResults: number;
  itemsPerPage: number;
  filteredAs: {
    userId: string;
    serverTotalScanned: number;
    serverTotalAvailable: number;
    scanComplete: boolean;
    scanIncompleteHint?: string;
  };
  items: Array<{ id: string; taskId: string }>;
}

function makeInterruption(overrides: {
  id: number;
  canTake?: boolean;
  hasResp?: boolean;
  responsibleUserId?: string;
}) {
  return {
    Id: `Interruptions-${overrides.id}`,
    Title: `Intervention ${overrides.id}`,
    Type: "ManualIntervention",
    Created: "2026-02-10T23:01:26.205+00:00",
    IsPending: true,
    CanTakeResponsibility: overrides.canTake ?? false,
    HasResponsibility: overrides.hasResp ?? false,
    ResponsibleUserId: overrides.responsibleUserId,
    ResponsibleTeamIds: [],
    RelatedDocumentIds: [],
    TaskId: `ServerTasks-${overrides.id}`,
    SpaceId: "Spaces-1",
    Form: { Values: {}, Elements: [] },
  };
}

function makePage(
  items: ReturnType<typeof makeInterruption>[],
  totalResults: number,
) {
  return {
    TotalResults: totalResults,
    ItemsPerPage: items.length,
    NumberOfPages: Math.max(1, Math.ceil(totalResults / Math.max(items.length, 1))),
    LastPageNumber: 0,
    Items: items,
  };
}

describe("findInterruptionsHandler — assignedToMe paging", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("scans subsequent pages when the first page contains zero matches (the original bug)", async () => {
    // Page 1: 100 unmatched interruptions (none assigned to Users-42).
    // Page 2: 5 matches.
    // Pre-fix behaviour: empty result, Users-42 silently misses 5 actionable interruptions.
    const page1 = makePage(
      Array.from({ length: ASSIGNED_SCAN_PAGE_SIZE }, (_, i) =>
        makeInterruption({ id: i + 1, canTake: false, hasResp: false }),
      ),
      105,
    );
    const matchedItems = Array.from({ length: 5 }, (_, i) =>
      makeInterruption({
        id: ASSIGNED_SCAN_PAGE_SIZE + i + 1,
        responsibleUserId: "Users-42",
      }),
    );
    const page2 = makePage(matchedItems, 105);

    get.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const response = await findInterruptionsHandler({
      spaceName: "Default",
      assignedToMe: true,
    });
    const data = parseToolResponse<AssignedWrapper>(response);

    expect(data.totalResults).toBe(5);
    expect(data.items).toHaveLength(5);
    expect(data.items.map((i) => i.id)).toEqual([
      "Interruptions-101",
      "Interruptions-102",
      "Interruptions-103",
      "Interruptions-104",
      "Interruptions-105",
    ]);
    expect(data.filteredAs.scanComplete).toBe(true);
    expect(data.filteredAs.serverTotalAvailable).toBe(105);
    expect(data.filteredAs.serverTotalScanned).toBe(105);
    expect(data.filteredAs.scanIncompleteHint).toBeUndefined();

    // Second call's skip should equal the first page's item count.
    expect(get).toHaveBeenCalledTimes(2);
    const secondCallArgs = get.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(secondCallArgs.skip).toBe(ASSIGNED_SCAN_PAGE_SIZE);
  });

  it("stops at the safety cap and signals scan incomplete via filteredAs", async () => {
    // Server claims many more interruptions than the cap. Each page reports
    // the same large total. The scan must stop at ASSIGNED_SCAN_MAX records
    // and surface scanComplete: false plus a hint.
    const fullPage = (startId: number) =>
      makePage(
        Array.from({ length: ASSIGNED_SCAN_PAGE_SIZE }, (_, i) =>
          makeInterruption({
            id: startId + i,
            // Mark every record as assigned so we can verify all collected.
            canTake: true,
          }),
        ),
        10_000,
      );

    for (let i = 0; i < ASSIGNED_SCAN_MAX / ASSIGNED_SCAN_PAGE_SIZE; i++) {
      get.mockResolvedValueOnce(fullPage(i * ASSIGNED_SCAN_PAGE_SIZE + 1));
    }
    // If the loop overshoots the cap and asks for another page, return a
    // marker that would fail the assertions below.
    get.mockResolvedValue(makePage([], 10_000));

    const response = await findInterruptionsHandler({
      spaceName: "Default",
      assignedToMe: true,
    });
    const data = parseToolResponse<AssignedWrapper>(response);

    expect(data.filteredAs.scanComplete).toBe(false);
    expect(data.filteredAs.serverTotalScanned).toBe(ASSIGNED_SCAN_MAX);
    expect(data.filteredAs.serverTotalAvailable).toBe(10_000);
    expect(data.filteredAs.scanIncompleteHint).toMatch(/safety cap/);
    expect(data.totalResults).toBe(ASSIGNED_SCAN_MAX);

    // Exactly cap / page-size requests, no more.
    expect(get).toHaveBeenCalledTimes(ASSIGNED_SCAN_MAX / ASSIGNED_SCAN_PAGE_SIZE);
  });

  it("treats a short page as exhaustion (pages smaller than the page size end the scan)", async () => {
    // Server total is 7. We request 100 and get 7 back → exhausted in one call.
    const onlyPage = makePage(
      [
        makeInterruption({ id: 1, canTake: true }),
        makeInterruption({ id: 2 }),
        makeInterruption({ id: 3, hasResp: true }),
        makeInterruption({ id: 4 }),
        makeInterruption({ id: 5 }),
        makeInterruption({ id: 6, responsibleUserId: "Users-42" }),
        makeInterruption({ id: 7 }),
      ],
      7,
    );
    get.mockResolvedValueOnce(onlyPage);

    const response = await findInterruptionsHandler({
      spaceName: "Default",
      assignedToMe: true,
    });
    const data = parseToolResponse<AssignedWrapper>(response);

    expect(data.filteredAs.scanComplete).toBe(true);
    expect(data.filteredAs.serverTotalAvailable).toBe(7);
    expect(data.filteredAs.serverTotalScanned).toBe(7);
    expect(data.totalResults).toBe(3);
    expect(data.items.map((i) => i.id)).toEqual([
      "Interruptions-1",
      "Interruptions-3",
      "Interruptions-6",
    ]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("applies caller skip/take to the post-filter set, not the unfiltered server set", async () => {
    // 10 matches across 1 page. take: 3, skip: 2 → return matches 3-5.
    const items = Array.from({ length: 10 }, (_, i) =>
      makeInterruption({ id: i + 1, canTake: true }),
    );
    get.mockResolvedValueOnce(makePage(items, 10));

    const response = await findInterruptionsHandler({
      spaceName: "Default",
      assignedToMe: true,
      skip: 2,
      take: 3,
    });
    const data = parseToolResponse<AssignedWrapper>(response);

    expect(data.totalResults).toBe(10); // total matches, not 3
    expect(data.items.map((i) => i.id)).toEqual([
      "Interruptions-3",
      "Interruptions-4",
      "Interruptions-5",
    ]);
  });

  it("returns an empty array (not an error) when no interruptions are assigned", async () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeInterruption({ id: i + 1, canTake: false, hasResp: false }),
    );
    get.mockResolvedValueOnce(makePage(items, 5));

    const response = await findInterruptionsHandler({
      spaceName: "Default",
      assignedToMe: true,
    });
    const data = parseToolResponse<AssignedWrapper>(response);

    expect(data.totalResults).toBe(0);
    expect(data.items).toEqual([]);
    expect(data.filteredAs.scanComplete).toBe(true);
  });
});

describe("findInterruptionsHandler — list mode (no assignedToMe)", () => {
  beforeEach(() => {
    get.mockReset();
    resolveSpaceId.mockReset();
    resolveSpaceId.mockResolvedValue("Spaces-1");
  });

  it("passes server pagination through unchanged and does not paginate", async () => {
    const items = [
      makeInterruption({ id: 1, canTake: false, hasResp: false }),
      makeInterruption({ id: 2, canTake: true }),
    ];
    get.mockResolvedValueOnce({
      TotalResults: 47,
      ItemsPerPage: 30,
      NumberOfPages: 2,
      LastPageNumber: 1,
      Items: items,
    });

    const response = await findInterruptionsHandler({
      spaceName: "Default",
    });
    const data = parseToolResponse<{
      totalResults: number;
      itemsPerPage: number;
      numberOfPages: number;
      lastPageNumber: number;
      filteredAs?: unknown;
      items: Array<{ id: string }>;
    }>(response);

    expect(data.totalResults).toBe(47);
    expect(data.itemsPerPage).toBe(30);
    expect(data.numberOfPages).toBe(2);
    expect(data.lastPageNumber).toBe(1);
    expect(data.filteredAs).toBeUndefined();
    expect(data.items).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
