import { type ClientConfiguration } from "@octopusdeploy/api-client";
import { env } from "process";
import { SEMVER_VERSION } from "../index.js";
import { getClientInfo } from "../utils/clientInfo.js";

const USER_AGENT_NAME = "octopus-mcp-server";

export interface ConfigurationOptions {
  instanceURL?: string;
  apiKey?: string;
}

function isEmpty(value: string | undefined): value is undefined | "" {
  return !value || value.trim().length === 0;
}

function constructUserAgent(): string {
  const clientInfo = getClientInfo();
  const userAgent = `${USER_AGENT_NAME}/${SEMVER_VERSION} (${clientInfo.name}/${clientInfo.version})`;

  return userAgent;
}

function getClientConfiguration(options: ConfigurationOptions = {}): ClientConfiguration {
  if (isEmpty(options.instanceURL) || isEmpty(options.apiKey)) {
    throw new Error(
      "Octopus server URL and API key must be provided either via command line arguments (--server-url, --api-key) or environment variables (OCTOPUS_SERVER_URL, OCTOPUS_API_KEY)."
    );
  }

  const userAgent = constructUserAgent();

  return {
    userAgentApp: userAgent,
    instanceURL: options.instanceURL,
    apiKey: options.apiKey,
  };
}

export function getClientConfigurationFromEnvironment(): ClientConfiguration {
  return getClientConfiguration({
    instanceURL: env["CLI_SERVER_URL"] || env["OCTOPUS_SERVER_URL"],
    apiKey: env["CLI_API_KEY"] || env["OCTOPUS_API_KEY"],
  });
}