/**
 * Wire-format types for the customer-facing Feature Toggles API.
 *
 * Octopus's @octopusdeploy/api-client (3.8.0) does not expose typed Repository
 * classes or Resource interfaces for feature toggles, so we declare the minimum
 * surface we touch here. Field names and casing match the JSON response from
 * /api/{spaceId}/projects/{projectId}/featuretoggles{,/{slug}}.
 */

export interface FeatureToggleEnvironmentResource {
  FeatureToggleId?: string;
  DeploymentEnvironmentId: string;
  IsEnabled: boolean;
  RolloutPercentage?: number;
  ClientRolloutPercentage?: number;
  TenantIds?: string[];
  ExcludedTenantIds?: string[];
  TenantTags?: string[];
  ExcludedTenantTags?: string[];
  Segments?: Array<{ Key: string; Value: string }>;
  MinimumVersion?: string | null;
}

export interface FeatureToggleResource {
  Id: string;
  SpaceId: string;
  ProjectId: string;
  Name: string;
  Slug: string;
  DefaultIsEnabled: boolean;
  Description?: string | null;
  Environments: FeatureToggleEnvironmentResource[];
  Tags: string[];
  RolloutGroupId?: string | null;
}

export interface RolloutGroupResource {
  Id: string;
  SpaceId: string;
  ProjectId: string;
  Name: string;
  FeatureToggleUsages: Array<{ Id: string; Name: string }>;
}
