import { type Client, type ResourceCollection } from "@octopusdeploy/api-client";
import { type GitBranch, type GetProjectBranchesOptions } from "../types/gitBranchTypes.js";

export async function getProjectBranches(
  client: Client,
  spaceId: string,
  projectId: string,
  options?: GetProjectBranchesOptions
): Promise<ResourceCollection<GitBranch>> {
  const queryParams: Record<string, string> = {};

  if (options?.searchByName) {
    queryParams.searchByName = options.searchByName;
  }

  if (options?.skip !== undefined) {
    queryParams.skip = options.skip.toString();
  }

  if (options?.take !== undefined) {
    queryParams.take = options.take.toString();
  }

  const result = await client.get<ResourceCollection<GitBranch>>(
    "~/api/{spaceId}/projects/{projectId}/git/branches{?skip,take,searchByName}",
    {
      spaceId,
      projectId,
      ...queryParams,
    },
  );

  return result;
}

// Mirrors the server-side extension methods in
// Octopus.Core.Model.Projects.PersistenceSettingsExtensionMethods. The
// api-client's PersistenceSettings discriminated union doesn't type
// ConversionState, so we walk it as unknown.

export function hasRunbooksInGit(persistence: unknown): boolean {
  if (typeof persistence !== "object" || persistence === null) return false;
  const conversionState = (persistence as Record<string, unknown>).ConversionState;
  if (typeof conversionState !== "object" || conversionState === null) return false;
  return (conversionState as Record<string, unknown>).RunbooksAreInGit === true;
}

export function hasVariablesInGit(persistence: unknown): boolean {
  if (typeof persistence !== "object" || persistence === null) return false;
  const conversionState = (persistence as Record<string, unknown>).ConversionState;
  if (typeof conversionState !== "object" || conversionState === null) return false;
  return (conversionState as Record<string, unknown>).VariablesAreInGit === true;
}
