import {
    Client,
    type Project,
    ProjectRepository,
    resolveSpaceId, type ResourcesById,
    type TenantVariable
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import type {ResourceCollection} from "@octopusdeploy/api-client/dist/resourceCollection.js";
import { logger } from "../utils/logger.js";

export function registerGetVariablesTool(server: McpServer) {
    server.tool(
        "get_variables",
        `Get all variables for a project. This tool retrieves all variables available to a project, 
  including project variables, library variable set variables, and tenant variables. Results include variable names, values, and scopes.
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

            const variables = await getAllVariables({
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
    toolName: "get_variables",
    config: { toolset: "projects", readOnly: true },
    registerFn: registerGetVariablesTool,
});

export type VariableResource = VariableResourceBase<ScopeSpecification, Readonly<unknown>>;

export interface VariableResourceBase<TScopeSpecification extends Readonly<ReadonlyArrays<ScopeSpecificationTypes>>, TVariablePromptOptions extends Readonly<unknown>> {
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
    projectVariableSet: Omit<VariableSetResource, "ScopeValues"> | undefined;
    libraryVariableSets: LibraryVariableSetWithVariables[];
    tenantVariables: string[];
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
): Promise<Omit<VariableSetResource, "ScopeValues"> | undefined> {

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

    let result: VariableSetResource;

    if (hasGitVariables) {
        // For git projects, we need to get both text and sensitive variables separately

        // Retrieve the variable set stored in git for the associated gitRef
        const textVariableSet = await apiClient.get<VariableSetResource>(
            `/api/spaces/${spaceId}/projects/${project.Id}/${gitRef}/variables`
        );

        // Sensitive variables are still stored in the database so that they can be encrypted
        const sensitiveVariableSet = await apiClient.get<VariableSetResource>(
            `/api/spaces/${spaceId}/projects/${project.Id}/variables`
        );

        // Combine variables from both sets
        result = {
            ...textVariableSet,
            Variables: [...textVariableSet.Variables, ...sensitiveVariableSet.Variables]
        };
    } else {
        // For database projects, get variables directly
        result = await apiClient.get<VariableSetResource>(`/api/spaces/${spaceId}/variables/${project.VariableSetId}`);
    }

    // Strip out scope values, as they are not useful and pollute context
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    delete result.ScopeValues;

    return result;
}

// TODO: No pagination in here, nor do we return pagination details to the LLM to further explore
// Think about how to solve.
async function loadLibraryVariableSetVariables(
    includedLibraryVariableSetIds: string[],
    apiClient: Client,
    spaceId: string
): Promise<LibraryVariableSetWithVariables[]> {

    if (includedLibraryVariableSetIds.length == 0) return [];

    // Get library variable sets
    const libraryVariableSets = await apiClient.get<ResourceCollection<LibraryVariableSetResource>>(
        `/api/spaces/${spaceId}/libraryvariablesets?ids=${includedLibraryVariableSetIds.join(',')}`
    );

    // Get all variable sets for the library variable sets
    const variableSetIds = libraryVariableSets.Items.map(lvs => lvs.VariableSetId);
    const allVariableSets = await apiClient.get<VariableSetResource[]>(
        `/api/spaces/${spaceId}/variables/all?ids=${variableSetIds.join(',')}`
    );

    // Create lookup map
    const allVariableSetsMap = allVariableSets.reduce((acc: ResourcesById<VariableSetResource>, resource) => {
        acc[resource.Id] = resource;
        return acc;
    }, {});

    // Combine library variable sets with their variable sets
    return libraryVariableSets.Items.map(lvs => ({
        variableSet: allVariableSetsMap[lvs.VariableSetId],
        libraryVariableSet: lvs
    }));
}

async function loadTenantVariables(
    projectId: string,
    apiClient: Client,
    spaceId: string
): Promise<string[]> {
    const response = await apiClient.get<{TenantVariableResources: TenantVariable[]}>(
        `/bff/spaces/${spaceId}/projects/${projectId}/tenantvariables`
    );

    const variableNames = new Set<string>();

    // Extract variable names from project variables templates
    // Note that this will be guaranteed to only have a single collection of ProjectVariables for the tenant
    response.TenantVariableResources.forEach(tenant => {
        Object.values(tenant.ProjectVariables || {}).forEach(projectVar => {
            projectVar.Templates?.forEach(template => {
                variableNames.add(template.Name);
            });
        });

        // Extract variable names from library variable sets templates
        Object.values(tenant.LibraryVariables || {}).forEach(libraryVar => {
            libraryVar.Templates?.forEach(template => {
                variableNames.add(template.Name);
            });
        });
    });

    return Array.from(variableNames).sort();
}
