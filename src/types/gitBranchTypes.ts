export interface GitBranch {
  IsProtected: boolean;
  Name: string;
  CanonicalName: string;
}

export interface GetProjectBranchesOptions {
  searchByName?: string;
  skip?: number;
  take?: number;
}