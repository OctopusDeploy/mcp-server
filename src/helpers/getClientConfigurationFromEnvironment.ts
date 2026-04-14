import { type ClientConfiguration } from "@octopusdeploy/api-client";
import { env } from "process";
import { SEMVER_VERSION } from "../utils/version.js";
import { getClientInfo } from "../utils/clientInfo.js";

const USER_AGENT_NAME = "octopus-mcp-server";

export interface ConfigurationOptions {
  instanceURL?: string;
  apiKey?: string;
  accessToken?: string;
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
  const hasApiKey = !isEmpty(options.apiKey);
  const hasAccessToken = !isEmpty(options.accessToken);

  if (isEmpty(options.instanceURL)) {
    throw new Error(
      "Octopus server URL must be provided either via command line argument (--server-url) or environment variable (OCTOPUS_SERVER_URL)."
    );
  }

  if (!hasApiKey && !hasAccessToken) {
    throw new Error(
      "Octopus authentication must be provided. Supply either an API key (--api-key or OCTOPUS_API_KEY) or an access token (--access-token or OCTOPUS_ACCESS_TOKEN)."
    );
  }

  const userAgent = constructUserAgent();

  if (hasAccessToken) {
    return {
      userAgentApp: userAgent,
      instanceURL: options.instanceURL,
      accessToken: options.accessToken,
    };
  }

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
    accessToken: env["CLI_ACCESS_TOKEN"] || env["OCTOPUS_ACCESS_TOKEN"],
  });
}