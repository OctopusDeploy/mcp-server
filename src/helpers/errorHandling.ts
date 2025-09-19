/**
 * Enhanced error handling utilities for Octopus Deploy MCP Server tools
 */

/**
 * Checks if the error is an Error instance and has a message containing the specified text
 */
export function isErrorWithMessage(error: unknown, messageFragment: string): error is Error {
  return error instanceof Error && error.message?.includes(messageFragment) === true;
}

/**
 * Common error handler for Octopus Deploy API errors with actionable messages
 */
export function handleOctopusApiError(error: unknown, context: {
  entityType?: string;
  entityId?: string;
  spaceName?: string;
  helpText?: string;
}): never {
  const { entityType, entityId, spaceName, helpText } = context;

  // Handle 404/not found errors
  if (isErrorWithMessage(error, 'not found') || isErrorWithMessage(error, '404')) {
    if (entityType && entityId && spaceName) {
      throw new Error(
        `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} '${entityId}' not found in space '${spaceName}'. ` +
        (helpText || `Verify the ${entityType} ID is correct using list_${entityType}s.`)
      );
    }
    if (spaceName) {
      throw new Error(
        `Space '${spaceName}' not found. Use list_spaces to see available spaces. Space names are case-sensitive.`
      );
    }
  }

  // Handle authentication errors
  if (isErrorWithMessage(error, 'authentication') ||
      isErrorWithMessage(error, '401') ||
      isErrorWithMessage(error, 'You must be logged in to request this resource') ||
      isErrorWithMessage(error, 'provide a valid API key')) {
    throw new Error(
      "Authentication failed. Ensure OCTOPUS_API_KEY environment variable is set with a valid API key. " +
      "You can generate an API key from your Octopus Deploy user profile."
    );
  }

  // Handle connection errors
  if (isErrorWithMessage(error, 'connect') || isErrorWithMessage(error, 'timeout')) {
    throw new Error(
      "Cannot connect to Octopus Deploy instance. Check that OCTOPUS_URL environment variable is set correctly " +
      "(e.g., 'https://your-instance.octopus.app') and that the instance is accessible."
    );
  }

  // Re-throw the original error if no specific handling applies
  throw error;
}

/**
 * Validates entity ID format with actionable error messages
 */
export function validateEntityId(id: string | undefined, entityType: string, prefix: string): void {
  if (!id) {
    // This shouldn't happen due to Zod validation, but kept for safety
    throw new Error(
      `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} ID is required. ` +
      `Use list_${entityType}s to find ${entityType} IDs.`
    );
  }

  if (!id.startsWith(prefix)) {
    throw new Error(
      `Invalid ${entityType} ID format '${id}'. ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} IDs should start with '${prefix}' followed by numbers. ` +
      `Use list_${entityType}s to find valid ${entityType} IDs.`
    );
  }
}

/**
 * Entity ID prefixes for common Octopus Deploy entities
 */
export const ENTITY_PREFIXES = {
  task: 'ServerTasks-',
  project: 'Projects-',
  environment: 'Environments-',
  tenant: 'Tenants-',
  release: 'Releases-',
  machine: 'Machines-',
  certificate: 'Certificates-',
  account: 'Accounts-',
  deploymentProcess: 'DeploymentProcesses-'
} as const;