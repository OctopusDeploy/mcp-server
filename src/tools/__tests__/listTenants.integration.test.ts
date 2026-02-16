import { describe, it, expect } from "vitest";
import { testConfig, parseToolResponse } from "./testSetup.js";
import { findTenantsHandler } from "../findTenants.js";

describe("listTenants Integration Tests", () => {
  describe("Successful scenarios", () => {
    it(
      "should list all tenants in the test space",
      async () => {
        const response = await findTenantsHandler({
          spaceName: testConfig.testSpaceName,
        });

        const data = parseToolResponse(response);

        expect(data).toHaveProperty("totalResults");
        expect(data).toHaveProperty("itemsPerPage");
        expect(data).toHaveProperty("numberOfPages");
        expect(data).toHaveProperty("lastPageNumber");
        expect(data).toHaveProperty("items");
        expect(Array.isArray(data.items)).toBe(true);

        // Verify tenant structure if any tenants exist
        if (data.items.length > 0) {
          const tenant = data.items[0];
          expect(tenant).toHaveProperty("id");
          expect(tenant).toHaveProperty("name");
          expect(tenant).toHaveProperty("slug");
          expect(tenant).toHaveProperty("description");
          expect(tenant).toHaveProperty("isDisabled");
          expect(tenant).toHaveProperty("tenantTags");
          expect(tenant).toHaveProperty("spaceId");
          expect(tenant).toHaveProperty("publicUrl");
          expect(tenant).toHaveProperty("publicUrlInstruction");
          expect(typeof tenant.id).toBe("string");
          expect(typeof tenant.name).toBe("string");
          expect(typeof tenant.slug).toBe("string");
          expect(typeof tenant.isDisabled).toBe("boolean");
          expect(typeof tenant.publicUrl).toBe("string");
        }
      },
      testConfig.timeout,
    );

    it(
      "should support pagination with skip and take parameters",
      async () => {
        const response = await findTenantsHandler({
          spaceName: testConfig.testSpaceName,
          skip: 0,
          take: 5,
        });

        const data = parseToolResponse(response);

        expect(data).toHaveProperty("totalResults");
        expect(data).toHaveProperty("itemsPerPage");
        expect(data.itemsPerPage).toBe(5);
        expect(data.items.length).toBeLessThanOrEqual(5);
      },
      testConfig.timeout,
    );

    it(
      "should support filtering by partial name",
      async () => {
        const response = await findTenantsHandler({
          spaceName: testConfig.testSpaceName,
          partialName: "test",
        });

        const data = parseToolResponse(response);
        expect(data).toHaveProperty("items");
        expect(Array.isArray(data.items)).toBe(true);

        // If results are found, verify they contain the search term
        data.items.forEach((tenant: any) => {
          if (tenant.name) {
            expect(tenant.name.toLowerCase()).toContain("test");
          }
        });
      },
      testConfig.timeout,
    );
  });

  describe("Error scenarios", () => {
    it(
      "should throw error for non-existent space",
      async () => {
        await expect(
          findTenantsHandler({
            spaceName: "NonExistentSpace123456",
          }),
        ).rejects.toThrow();
      },
      testConfig.timeout,
    );

    it(
      "should handle empty results gracefully",
      async () => {
        const response = await findTenantsHandler({
          spaceName: testConfig.testSpaceName,
          partialName: "ThisTenantNameShouldNotExist123456789",
        });

        const data = parseToolResponse(response);
        expect(data).toHaveProperty("items");
        expect(Array.isArray(data.items)).toBe(true);
        expect(data.items.length).toBe(0);
        expect(data.totalResults).toBe(0);
      },
      testConfig.timeout,
    );
  });
});
