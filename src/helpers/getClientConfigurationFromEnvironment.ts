import { type ClientConfiguration } from "@octopusdeploy/api-client";
import { env } from "process";
import { SEMVER_VERSION } from "../utils/version.js";
import { getClientInfo } from "../utils/clientInfo.js";
import { logger } from "../utils/logger.js";

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

export function getClientConfiguration(options: ConfigurationOptions = {}): ClientConfiguration {
  const hasApiKey = !isEmpty(options.apiKey);
  const hasAccessToken = !isEmpty(options.accessToken);

  if (isEmpty(options.instanceURL)) {
    throw new Error(
      "Octopus server URL must be provided either via command line argument (--server-url) or environment variable (OCTOPUS_SERVER_URL)."
    );
  }

  if (!hasApiKey && !hasAccessToken) {
    throw new Error(
      "Octopus authentication must be provided via OCTOPUS_API_KEY or OCTOPUS_ACCESS_TOKEN environment variable."
    );
  }

  const userAgent = constructUserAgent();

  if (hasAccessToken) {
    logger.info("Authenticating with access token (Bearer)");
    return {
      userAgentApp: userAgent,
      instanceURL: options.instanceURL,
      accessToken: options.accessToken,
    };
  }

  logger.info("Authenticating with API key");
  return {
    userAgentApp: userAgent,
    instanceURL: options.instanceURL,
    apiKey: options.apiKey,
  };
}

export function getClientConfigurationFromEnvironment(): ClientConfiguration {
  return getClientConfiguration({
    instanceURL: env["CLI_SERVER_URL"] || env["OCTOPUS_SERVER_URL"],
    apiKey: env["OCTOPUS_API_KEY"],
    accessToken: env["OCTOPUS_ACCESS_TOKEN"],
  });
}
