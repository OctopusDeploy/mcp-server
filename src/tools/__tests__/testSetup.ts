import { expect } from "vitest";
import { config } from "dotenv";

// Load environment variables from .env files
config();

export const testConfig = {
  octopusServerUrl: process.env.OCTOPUS_SERVER_URL || process.env.CLI_SERVER_URL,
  octopusApiKey: process.env.OCTOPUS_API_KEY,
  octopusAccessToken: process.env.OCTOPUS_ACCESS_TOKEN,
  testSpaceName: process.env.TEST_SPACE_NAME || "Default",
  timeout: 30000, // 30 seconds
};

export function validateTestEnvironment(): void {
  const missing: string[] = [];

  if (!testConfig.octopusServerUrl) {
    missing.push("OCTOPUS_SERVER_URL (or CLI_SERVER_URL)");
  }

  if (!testConfig.octopusApiKey && !testConfig.octopusAccessToken) {
    missing.push("OCTOPUS_API_KEY or OCTOPUS_ACCESS_TOKEN");
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

export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
}

export function assertToolResponse(response: unknown): asserts response is ToolResponse {
  expect(response).toBeDefined();
  const r = response as ToolResponse;
  expect(r.content).toBeDefined();
  expect(Array.isArray(r.content)).toBe(true);
  expect(r.content.length).toBeGreaterThan(0);
  expect(r.content[0].type).toBe("text");
  expect(r.content[0].text).toBeDefined();
}

export function parseToolResponse<T = unknown>(response: unknown): T {
  assertToolResponse(response);
  return JSON.parse(response.content[0].text) as T;
}
