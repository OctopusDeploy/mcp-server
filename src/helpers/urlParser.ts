export interface OctopusUrlParts {
  serverUrl: string;
  spaceId?: string;
  resourceType?: "deployment" | "release" | "project" | "tenant" | "task" | "unknown";
  resourceId?: string;
  projectSlug?: string;
  releaseVersion?: string;
}

export function parseOctopusUrl(url: string): OctopusUrlParts {
  try {
    const urlObj = new URL(url);
    const serverUrl = `${urlObj.protocol}//${urlObj.host}`;

    const hashPath = urlObj.hash.startsWith("#/") ? urlObj.hash.substring(2) : urlObj.hash.substring(1);
    const pathParts = hashPath.split("/").filter(Boolean);

    const result: OctopusUrlParts = {
      serverUrl,
    };

    const spaceId = extractSpaceId(url);
    if (spaceId) {
      result.spaceId = spaceId;
    }

    if (pathParts.includes("deployments")) {
      const deploymentId = extractDeploymentId(url);
      if (deploymentId) {
        result.resourceType = "deployment";
        result.resourceId = deploymentId;
      } else {
        const releaseVersion = extractReleaseVersion(url);
        if (releaseVersion) {
          result.resourceType = "release";
          result.resourceId = releaseVersion;
          result.releaseVersion = releaseVersion;
        }
      }
    } else if (pathParts.includes("tasks")) {
      const taskId = extractTaskId(url);
      if (taskId) {
        result.resourceType = "task";
        result.resourceId = taskId;
      }
    } else if (pathParts.includes("projects")) {
      result.resourceType = "project";
      const projectSlug = extractProjectSlug(url);
      if (projectSlug) {
        result.projectSlug = projectSlug;
      }
    } else if (pathParts.includes("tenants")) {
      const tenantId = extractTenantId(url);
      if (tenantId) {
        result.resourceType = "tenant";
        result.resourceId = tenantId;
      }
    } else {
      result.resourceType = "unknown";
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to parse Octopus URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function extractDeploymentId(url: string): string | null {
  const match = url.match(/\/deployments\/(Deployments-\d+)/);
  return match ? match[1] : null;
}

export function extractTaskId(url: string): string | null {
  const match = url.match(/\/tasks\/(ServerTasks-\d+)/);
  return match ? match[1] : null;
}

export function extractSpaceId(url: string): string | null {
  const match = url.match(/\/(Spaces-\d+)/);
  return match ? match[1] : null;
}

export function extractProjectSlug(url: string): string | null {
  const match = url.match(/\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

export function extractReleaseVersion(url: string): string | null {
  const match = url.match(/\/releases\/([^/]+)/);
  return match ? match[1] : null;
}

export function extractTenantId(url: string): string | null {
  const match = url.match(/\/tenants\/(Tenants-\d+)/);
  return match ? match[1] : null;
}
