/**
 * Global storage for MCP client information obtained during initialization
 */

interface ClientInfo {
  name?: string;
  version?: string;
}

let globalClientInfo: ClientInfo = {};

/**
 * Stores the client name and version globally for use throughout the application
 * @param name Client name from initialization
 * @param version Client version from initialization
 */
export function setClientInfo(name: string | undefined, version: string | undefined): void {
  globalClientInfo = {
    name,
    version
  };
}

/**
 * Gets the complete client information
 * @returns Object containing client name and version
 */
export function getClientInfo(): ClientInfo {
  return { ...globalClientInfo };
}