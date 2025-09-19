import { beforeAll, expect } from "vitest";
import { config } from "dotenv";

// Load environment variables from .env files
config();

export const testConfig = {
  octopusServerUrl: process.env.OCTOPUS_SERVER_URL || process.env.CLI_SERVER_URL,
  octopusApiKey: process.env.OCTOPUS_API_KEY || process.env.CLI_API_KEY,
  testSpaceName: process.env.TEST_SPACE_NAME || "Default",
  timeout: 30000, // 30 seconds
};

export function validateTestEnvironment(): void {
  const missing: string[] = [];

  if (!testConfig.octopusServerUrl) {
    missing.push("OCTOPUS_SERVER_URL (or CLI_SERVER_URL)");
  }

  if (!testConfig.octopusApiKey) {
    missing.push("OCTOPUS_API_KEY (or CLI_API_KEY)");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for integration tests: ${missing.join(", ")}. ` +
      "Please set these variables or create a .env file in the project root."
    );
  }
}

/**
 * Helper function to create a standardized error test case
 */
export function createErrorTestCase(
  description: string,
  setupFn: () => void,
  expectedErrorMessage?: string
) {
  return {
    description,
    setup: setupFn,
    expectedErrorMessage,
  };
}

export function assertToolResponse(response: any): void {
  expect(response).toBeDefined();
  expect(response.content).toBeDefined();
  expect(Array.isArray(response.content)).toBe(true);
  expect(response.content.length).toBeGreaterThan(0);
  expect(response.content[0].type).toBe("text");
  expect(response.content[0].text).toBeDefined();
}

export function parseToolResponse(response: any): any {
  assertToolResponse(response);
  return JSON.parse(response.content[0].text);
}

beforeAll(() => {
  validateTestEnvironment();
});