import { type NamedResource, type SpaceScopedResource, type ResourceWithSlug } from "./baseResource.js";

export const MachineModelHealthStatusValues = {
    Healthy: "Healthy",
    Unavailable: "Unavailable",
    Unknown: "Unknown",
    HasWarnings: "HasWarnings",
    Unhealthy: "Unhealthy",
} as const;

export type MachineModelHealthStatus = (typeof MachineModelHealthStatusValues)[keyof typeof MachineModelHealthStatusValues];

export interface MachineModelHealthStatusResource {
    Id: MachineModelHealthStatus;
    Name: string;
}

export const CommunicationStyleValues = {
    None: "None",
    TentaclePassive: "TentaclePassive",
    TentacleActive: "TentacleActive",
    Ssh: "Ssh",
    OfflineDrop: "OfflineDrop",
    AzureWebApp: "AzureWebApp",
    AzureCloudService: "AzureCloudService",
    AzureServiceFabricCluster: "AzureServiceFabricCluster",
    Kubernetes: "Kubernetes",
    KubernetesTentacle: "KubernetesTentacle",
    StepPackage: "StepPackage",
} as const;

export type CommunicationStyle = (typeof CommunicationStyleValues)[keyof typeof CommunicationStyleValues];

export enum AgentCommunicationMode {
    Polling = "Polling",
    Listening = "Listening",
}

export interface CommunicationStyleResource {
    Id: CommunicationStyle;
    Name: string;
}

export interface TentacleDetailsResource {
    UpgradeLocked: boolean;
    Version: string;
    UpgradeSuggested: boolean;
    UpgradeRequired: boolean;
    UpgradeAvailable: boolean;
}

export const TenantedDeploymentModeValues = {
    Untenanted: "Untenanted",
    TenantedOrUntenanted: "TenantedOrUntenanted",
    Tenanted: "Tenanted",
} as const;

export type TenantedDeploymentMode = (typeof TenantedDeploymentModeValues)[keyof typeof TenantedDeploymentModeValues];

export interface EndpointResource {
    Id: string;
    CommunicationStyle: CommunicationStyle;
    Fingerprint?: string;
    Uri?: string;
    ProxyId?: string;
    TentacleVersionDetails?: TentacleDetailsResource;
}

export interface NewEndpointResource extends Omit<EndpointResource, "Id"> {}

export interface MachineResource extends NamedResource, SpaceScopedResource, ResourceWithSlug {
    IsDisabled: boolean;
    MachinePolicyId: string;
    HealthStatus: MachineModelHealthStatus;
    HasLatestCalamari: boolean;
    StatusSummary: string;
    IsInProcess: boolean;
    Endpoint: EndpointResource;
    ShellName: string;
}

export interface DeploymentTargetResource extends MachineResource {
    EnvironmentIds: string[];
    Roles: string[];
    TenantedDeploymentParticipation: TenantedDeploymentMode;
    TenantIds: string[];
    TenantTags: string[];
}

export type NewMachineResource = {
    Endpoint: NewEndpointResource;
} & Omit<MachineResource, "Id" | "Links" | "Endpoint" | "StatusSummary" | "SpaceId">;