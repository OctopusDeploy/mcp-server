import {
    Client,
    type DeploymentEnvironment, type Project,
    ProjectRepository,
    resolveSpaceId, type ResourcesById,
    type TenantVariable, type VersionControlledPersistenceSettings
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import type {Tenant} from "@octopusdeploy/api-client/dist/features/tenants/tenant.js";

export function registerGetTenantVariablesTool(server: McpServer) {
    server.tool(
        "get_variables",
        `Get all variables for a project. This tool retrieves all variables available to a project, 
  including project variables, library variable set variables, and tenant variables.
  Results include variable names, values, and scopes.
  `,
        {
            spaceName: z.string().describe("The space name"),
            projectId: z.string().describe("The ID of the project to retrieve the variables for"),
            gitRef: z.string().describe("The gitRef to retrieve the variables from, if the project is a config-as-code project").optional(),
        },
        {
            title: "Get variables for a Project from Octopus Deploy",
            readOnlyHint: true,
        },
        async ({ spaceName, projectId, gitRef }) => {

            const configuration = getClientConfigurationFromEnvironment();
            const client = await Client.create(configuration);
            const spaceId = await resolveSpaceId(client, spaceName);

            const variables = getAllVariables({
                projectId: projectId,
                spaceName: spaceName,
                spaceId: spaceId,
                gitRef: gitRef,
                ephemeralEnvironmentsAreEnabled: false
            }, client)

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            variables
                        }),
                    },
                ],
            };
        }
    );
}

registerToolDefinition({
    toolName: "get_tenant_variables",
    config: { toolset: "tenants", readOnly: true },
    registerFn: registerGetTenantVariablesTool,
});

export type VariableResource = VariableResourceBase<ScopeSpecification, VariablePromptOptions>;

export interface VariableResourceBase<TScopeSpecification extends Readonly<ReadonlyArrays<ScopeSpecificationTypes>>, TVariablePromptOptions extends Readonly<VariablePromptOptions>> {
    Id: string;
    Name: string;
    Value: string | null;
    Description: string | undefined;
    Scope: TScopeSpecification;
    IsEditable: boolean;
    Prompt: TVariablePromptOptions | null;
    Type: VariableType;
    IsSensitive: boolean; //false; // For backwards compatibility
}

type Arrays<T> = {
    [P in keyof T]: Array<T[P]>;
};

type ReadonlyArrays<T> = {
    [P in keyof T]: ReadonlyArray<T[P]>;
};

export type ScopeSpecification = Arrays<ScopeSpecificationTypes>;

export interface ScopeSpecificationTypes {
    Environment?: string;
    Machine?: string;
    Role?: string;
    Action?: string;
    Channel?: string;
    TenantTag?: string;
    ProcessOwner?: string;
}

export interface VariablePromptOptions {
    Label: string;
    Description: string;
    Required: boolean;
    DisplaySettings: VariablePromptDisplaySettings;
}

export enum ControlType {
    SingleLineText = "SingleLineText",
    MultiLineText = "MultiLineText",
    Select = "Select",
    Checkbox = "Checkbox",
    Sensitive = "Sensitive",
    StepName = "StepName",
    AzureAccount = "AzureAccount",
    Certificate = "Certificate",
    WorkerPool = "WorkerPool",
    AmazonWebServicesAccount = "AmazonWebServicesAccount",
    UsernamePasswordAccount = "UsernamePasswordAccount",
    GoogleCloudAccount = "GoogleCloudAccount",
    GenericOidcAccount = "GenericOidcAccount",
    Package = "Package",
    Custom = "Custom",
    TargetTags = "TargetTags",
    Feed = "Feed",
    Environments = "Environments",
    TenantTags = "TenantTags",
    Teams = "Teams",
    Channels = "Channels",
    Project = "Project",
}

export interface VariablePromptDisplaySettings {
    "Octopus.ControlType"?: ControlType;
    "Octopus.SelectOptions"?: string;
}

export enum VariableType {
    String = "String",
    Sensitive = "Sensitive",
    Certificate = "Certificate",
    AmazonWebServicesAccount = "AmazonWebServicesAccount",
    AzureAccount = "AzureAccount",
    GoogleCloudAccount = "GoogleCloudAccount",
    WorkerPool = "WorkerPool",
    UsernamePasswordAccount = "UsernamePasswordAccount",
    GenericOidcAccount = "GenericOidcAccount",
}

export type ReferenceType = VariableType.Certificate | VariableType.AmazonWebServicesAccount | VariableType.AzureAccount | VariableType.WorkerPool | VariableType.GoogleCloudAccount | VariableType.GenericOidcAccount;
export type VariableAccountType = VariableType.AmazonWebServicesAccount | VariableType.AzureAccount | VariableType.GoogleCloudAccount | VariableType.UsernamePasswordAccount | VariableType.GenericOidcAccount;


interface VariableSetResource {
    Id: string;
    SpaceId: string;
    OwnerId: string;
    ScopeValues: ScopeValues;
    Variables: VariableResource[];
    Version: number;
}

interface ReferenceDataItem {
    Id: string;
    Name: string;
}

interface ProcessReferenceDataItem extends ReferenceDataItem {
    ProcessType: ProcessType;
}

enum ProcessType {
    Deployment = "Deployment",
    Runbook = "Runbook",
    ProcessTemplate = "ProcessTemplate",
}

interface ScopeValues {
    Actions: ReferenceDataItem[];
    Channels: ReferenceDataItem[];
    Environments: ReferenceDataItem[];
    Machines: ReferenceDataItem[];
    Roles: ReferenceDataItem[];
    TenantTags: ReferenceDataItem[];
    Processes: ProcessReferenceDataItem[];
}

enum VariableSetContentType {
    Variables = "Variables",
    ScriptModule = "ScriptModule",
}

type PropertyValueResource = string | SensitiveValue | null;

interface SensitiveValue {
    HasValue: boolean;
    // NewValue can also be null at runtime
    NewValue?: string;
    Hint?: string;
}

interface ActionTemplateParameterResource {
    Id: string;
    Name: string;
    Label: string;
    HelpText: string;
    DefaultValue?: PropertyValueResource;
    DisplaySettings: unknown;
    AllowClear?: boolean;
}

interface LibraryVariableSetResource  {
    Name: string;
    SpaceId: string;
    Description: string;
    VariableSetId: string;
    ContentType: VariableSetContentType;
    Templates: ActionTemplateParameterResource[];
}

interface LibraryVariableSetWithVariables {
    variableSet: VariableSetResource;
    libraryVariableSet: LibraryVariableSetResource;
}

interface AllVariablesForProject {
    projectVariableSet: VariableSetResource | undefined;
    libraryVariableSets: LibraryVariableSetWithVariables[];
    tenantVariables: TenantVariable[];
}

interface GetAllVariablesParams {
    projectId: string;
    gitRef?: string;
    spaceName: string;
    spaceId: string;
    ephemeralEnvironmentsAreEnabled?: boolean;
}

export async function getAllVariables(
    params: GetAllVariablesParams,
    apiClient: Client
): Promise<AllVariablesForProject> {

    const { spaceId, spaceName, gitRef, projectId } = params;

    // 1. Get the project to understand its configuration
    const projectRepository = new ProjectRepository(apiClient, spaceName);
    const project = await projectRepository.get(projectId);

    // 2. Load project variables (handling git persistence)
    const projectVariableSet = await loadProjectVariableSet(project, gitRef, apiClient, spaceId);

    // 3. Load library variable sets
    const libraryVariableSets = await loadLibraryVariableSetVariables(project.IncludedLibraryVariableSetIds, apiClient, spaceId);

    // 4. Load tenant variables
    const tenantVariables = await loadTenantVariables(project.Id, apiClient, spaceId);

    return {
        projectVariableSet,
        libraryVariableSets,
        tenantVariables,
    };
}

async function loadProjectVariableSet(
    project: Project,
    gitRef: string | undefined,
    apiClient: Client,
    spaceId: string
): Promise<VariableSetResource | undefined> {

    // This is a bit hacky,  but gets around the limitations of our ts client types without having to define
    // a heap of new types.
    // We are expecting the type to match { ConversionState: { VariablesAreInGit: true } }
    // If the variables are stored in git.
    function hasVariablesInGit(value: unknown): boolean {
        if (typeof value !== 'object' || value === null || !('ConversionState' in value)) {
            return false;
        }

        const obj = value as Record<string, unknown>;
        const conversionState = obj.ConversionState;

        return (
            typeof conversionState === 'object' &&
            conversionState !== null &&
            'VariablesAreInGit' in conversionState &&
            (conversionState as Record<string, unknown>).VariablesAreInGit === true
        );
    }

    // Check if project has git persistence
    const hasGitVariables = hasVariablesInGit(project.PersistenceSettings);

    if (hasGitVariables && !gitRef) {
        // TODO: Should we throw an error here for MCP?
        // If we've just changed from an invalid branch, GitRef might be null. Wait until it's set.
        return undefined;
    }

    if (hasGitVariables) {
        // For git projects, we need to get both text and sensitive variables separately

        // Retrieve the variable set stored in git for the associated gitRef
        const textVariableSet = await apiClient.get<VariableSetResource>(
            `/api/${spaceId}/projects/${project.Id}/${gitRef}/variables`
        );

        // Sensitive variables are still stored in the database so that they can be encrypted
        const sensitiveVariableSet = await apiClient.get<VariableSetResource>(
            `/api/${spaceId}/projects/${project.Id}/variables`
        );

        // Combine variables from both sets
        return {
            ...textVariableSet,
            Variables: [...textVariableSet.Variables, ...sensitiveVariableSet.Variables]
        };
    } else {
        // For database projects, get variables directly
        return await apiClient.get<VariableSetResource>(`/api/${spaceId}/variables/${project.VariableSetId}`);
    }
}

async function loadLibraryVariableSetVariables(
    includedLibraryVariableSetIds: string[],
    apiClient: Client,
    spaceId: string
): Promise<LibraryVariableSetWithVariables[]> {

    // Get library variable sets
    const libraryVariableSets = await apiClient.get<LibraryVariableSetResource[]>(
        `/api/${spaceId}/libraryvariablesets?ids=${includedLibraryVariableSetIds.join(',')}`
    );

    // Get all variable sets for the library variable sets
    const variableSetIds = libraryVariableSets.map(lvs => lvs.VariableSetId);
    const allVariableSets = await apiClient.get<VariableSetResource[]>(
        `/api/${spaceId}/variables?ids=${variableSetIds.join(',')}`
    );

    // Create lookup map
    const allVariableSetsMap = allVariableSets.reduce((acc: ResourcesById<VariableSetResource>, resource) => {
        acc[resource.Id] = resource;
        return acc;
    }, {});

    // Combine library variable sets with their variable sets
    return libraryVariableSets.map(lvs => ({
        variableSet: allVariableSetsMap[lvs.VariableSetId],
        libraryVariableSet: lvs
    }));
}

async function loadTenantVariables(
    projectId: string,
    apiClient: Client,
    spaceId: string
): Promise<TenantVariable[]> {
    const response = await apiClient.get<{TenantVariableResources: TenantVariable[]}>(
        `/bff/spaces/${spaceId}/projects/${projectId}/tenantvariables`
    );
    return response.TenantVariableResources;
}
