import { type ClientConfiguration } from "@octopusdeploy/api-client";
import { env } from "process";

export function getClientConfigurationFromEnvironment(): ClientConfiguration {
  const instanceURL = env["OCTOPUS_SERVER_URL"];
  const apiKey = env["OCTOPUS_API_KEY"];

  if (!instanceURL || !apiKey) {
    throw new Error(
      "Environment variables OCTOPUS_SERVER_URL and OCTOPUS_API_KEY must be set."
    );
  }

  return {
    userAgentApp: "octopus-mcp-server",
    instanceURL,
    apiKey,
  };
}