import { Client, type ResourceCollection } from "@octopusdeploy/api-client";
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