import { describe, it, expect } from "vitest";
import { testConfig, parseToolResponse } from "./testSetup.js";
import { findInterruptionsHandler } from "../findInterruptions.js";
import { clearUserCache } from "../../helpers/userCache.js";

interface InterruptionSummary {
  id: string;
  title: string;
  type?: string;
  taskId: string;
  correlationId?: string;
  isPending: boolean;
  isLinkedToOtherInterruption?: boolean;
  created: string;
  relatedDocumentIds: string[];
  responsible: {
    teamIds: string[];
    userId?: string;
    canTakeResponsibility: boolean;
    hasResponsibility: boolean;
  };
  formElementNames: string[];
  resourceUri: string;
  taskResourceUri: string;
  publicUrl: string;
  publicUrlInstruction: string;
}

interface PaginatedInterruptions {
  totalResults: number;
  itemsPerPage: number;
  numberOfPages: number;
  lastPageNumber: number;
  filteredAs?: { userId: string };
  items: InterruptionSummary[];
}

describe("findInterruptions Integration Tests", () => {
  describe("Successful scenarios", () => {
    it(
      "returns a paginated wrapper with items[]",
      async () => {
        const response = await findInterruptionsHandler({
          spaceName: testConfig.testSpaceName,
        });

        const data = parseToolResponse<PaginatedInterruptions>(response);
        expect(data).toHaveProperty("totalResults");
        expect(data).toHaveProperty("itemsPerPage");
        expect(data).toHaveProperty("numberOfPages");
        expect(data).toHaveProperty("lastPageNumber");
        expect(Array.isArray(data.items)).toBe(true);

        if (data.items.length > 0) {
          const first = data.items[0];
          expect(first).toHaveProperty("id");
          expect(first).toHaveProperty("title");
          expect(first).toHaveProperty("taskId");
          expect(first).toHaveProperty("isPending");
          expect(first).toHaveProperty("responsible");
          expect(first).toHaveProperty("formElementNames");
          expect(Array.isArray(first.formElementNames)).toBe(true);
          expect(first.resourceUri).toMatch(
            /^octopus:\/\/spaces\/.+\/interruptions\/Interruptions-.+$/,
          );
          expect(first.taskResourceUri).toMatch(
            /^octopus:\/\/spaces\/.+\/tasks\/ServerTasks-.+$/,
          );
          expect(first.publicUrl).toContain("/app#/");
          expect(first.publicUrl).toContain("/tasks/");
        }
      },
      testConfig.timeout,
    );

    it(
      "respects pendingOnly: false (returns at least as many as pendingOnly: true)",
      async () => {
        const pending = parseToolResponse<PaginatedInterruptions>(
          await findInterruptionsHandler({
            spaceName: testConfig.testSpaceName,
            pendingOnly: true,
          }),
        );

        const all = parseToolResponse<PaginatedInterruptions>(
          await findInterruptionsHandler({
            spaceName: testConfig.testSpaceName,
            pendingOnly: false,
          }),
        );

        expect(all.totalResults).toBeGreaterThanOrEqual(pending.totalResults);
      },
      testConfig.timeout,
    );

    it(
      "respects skip/take pagination",
      async () => {
        const response = await findInterruptionsHandler({
          spaceName: testConfig.testSpaceName,
          pendingOnly: false,
          skip: 0,
          take: 5,
        });

        const data = parseToolResponse<PaginatedInterruptions>(response);
        expect(data.items.length).toBeLessThanOrEqual(5);
      },
      testConfig.timeout,
    );

    it(
      "filters by `regarding` and returns the same shape (possibly empty)",
      async () => {
        const response = await findInterruptionsHandler({
          spaceName: testConfig.testSpaceName,
          regarding: "ServerTasks-doesnotexist-99999999",
          pendingOnly: false,
        });

        const data = parseToolResponse<PaginatedInterruptions>(response);
        expect(data).toHaveProperty("items");
        expect(Array.isArray(data.items)).toBe(true);
      },
      testConfig.timeout,
    );

    it(
      "assignedToMe surfaces filteredAs.userId in the wrapper and caches /users/me",
      async () => {
        clearUserCache();

        const first = parseToolResponse<PaginatedInterruptions>(
          await findInterruptionsHandler({
            spaceName: testConfig.testSpaceName,
            assignedToMe: true,
          }),
        );

        expect(first.filteredAs).toBeDefined();
        expect(typeof first.filteredAs?.userId).toBe("string");
        expect(first.filteredAs?.userId).toMatch(/^Users-/);

        const second = parseToolResponse<PaginatedInterruptions>(
          await findInterruptionsHandler({
            spaceName: testConfig.testSpaceName,
            assignedToMe: true,
          }),
        );
        expect(second.filteredAs?.userId).toBe(first.filteredAs?.userId);

        for (const item of second.items) {
          expect(
            item.responsible.canTakeResponsibility ||
              item.responsible.hasResponsibility ||
              item.responsible.userId === second.filteredAs?.userId,
          ).toBe(true);
        }
      },
      testConfig.timeout,
    );

    it(
      "omits filteredAs when assignedToMe is not set",
      async () => {
        const data = parseToolResponse<PaginatedInterruptions>(
          await findInterruptionsHandler({
            spaceName: testConfig.testSpaceName,
          }),
        );

        expect(data.filteredAs).toBeUndefined();
      },
      testConfig.timeout,
    );

    it(
      "single-id lookup: interruptionId returns one summary, not a paginated wrapper",
      async () => {
        const list = parseToolResponse<PaginatedInterruptions>(
          await findInterruptionsHandler({
            spaceName: testConfig.testSpaceName,
            pendingOnly: false,
            take: 1,
          }),
        );

        if (list.items.length === 0) {
          // Nothing to drill into on this instance — assertion would be vacuous.
          return;
        }

        const target = list.items[0];

        const single = parseToolResponse<InterruptionSummary>(
          await findInterruptionsHandler({
            spaceName: testConfig.testSpaceName,
            interruptionId: target.id,
          }),
        );

        expect(single).not.toHaveProperty("totalResults");
        expect(single).not.toHaveProperty("items");
        expect(single.id).toBe(target.id);
        expect(single.taskId).toBe(target.taskId);
        expect(single.resourceUri).toBe(target.resourceUri);
        expect(single.taskResourceUri).toBe(target.taskResourceUri);
      },
      testConfig.timeout,
    );
  });

  describe("Error scenarios", () => {
    it(
      "throws for a non-existent space",
      async () => {
        await expect(
          findInterruptionsHandler({
            spaceName: "NonExistentSpace123456",
          }),
        ).rejects.toThrow();
      },
      testConfig.timeout,
    );

    it(
      "throws for a malformed interruption ID before any API call",
      async () => {
        await expect(
          findInterruptionsHandler({
            spaceName: testConfig.testSpaceName,
            interruptionId: "not-a-real-id",
          }),
        ).rejects.toThrow(/Invalid interruption ID format/);
      },
      testConfig.timeout,
    );
  });
});
