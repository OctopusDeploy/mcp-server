import { type NamedResource, type SpaceScopedResource } from "./baseResource.js";

export const tenantsDescription = "Tenants represent customers or clients in Octopus Deploy, allowing you to manage deployments and configurations specific to each tenant. Tenants can be grouped into tenant tags for easier management and deployment targeting. Tenants can also represent geographical locations, organizational units, or any other logical grouping.";

export interface TenantResource extends SpaceScopedResource, NamedResource {
    IsDisabled: boolean | undefined;
    Slug: string;
    Description: string | null;
    ClonedFromTenantId: string | null;
    TenantTags: string[];
    ProjectEnvironments: {
        [projectId: string]: string[];
    };
}