import { type ResourceWithId, type ResourceWithSlug } from "./baseResource.js";

export enum StartTrigger {
  StartWithPrevious = "StartWithPrevious",
  StartAfterPrevious = "StartAfterPrevious",
}

export enum RunCondition {
  Success = "Success",
  Failure = "Failure",
  Always = "Always",
  Variable = "Variable",
}

export enum PackageRequirement {
  LetOctopusDecide = "LetOctopusDecide",
  BeforePackageAcquisition = "BeforePackageAcquisition",
  AfterPackageAcquisition = "AfterPackageAcquisition",
}

export interface DeploymentStepResource extends ResourceWithId, ResourceWithSlug {
  Id: string;
  Name: string;
  Properties: Record<string, any>;
  Condition: RunCondition;
  StartTrigger: StartTrigger;
  PackageRequirement: PackageRequirement;
  Actions: any[];
}

export interface DeploymentProcessResource extends ResourceWithId {
  ProjectId: string;
  SpaceId: string;
  Version: number;
  Steps: DeploymentStepResource[];
  LastSnapshotId?: string;
}