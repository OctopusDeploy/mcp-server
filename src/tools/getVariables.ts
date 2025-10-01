import {
    Client,
    type Project,
    ProjectRepository,
    resolveSpaceId, type ResourcesById
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import type {ResourceCollection} from "@octopusdeploy/api-client/dist/resourceCollection.js";

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
                gitRef: gitRef
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

type VariableResource = {
    Id: string;
    Name: string;
    Value: string | null;
    Description: string | undefined;
    Scope: ScopeSpecification;
    IsEditable: boolean;
    Prompt: Readonly<unknown>;
    Type: unknown;
    IsSensitive: boolean; //false; // For backwards compatibility
}

type Arrays<T> = {
    [P in keyof T]: Array<T[P]>;
};

type ScopeSpecification = Arrays<ScopeSpecificationTypes>;

interface ScopeSpecificationTypes {
    Environment?: string;
    Machine?: string;
    Role?: string;
    Action?: string;
    Channel?: string;
    TenantTag?: string;
    ProcessOwner?: string;
}

interface VariableSetResource {
    Id: string;
    SpaceId: string;
    OwnerId: string;
    ScopeValues: unknown;
    Variables: VariableResource[];
    Version: number;
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
    ContentType: unknown;
    Templates: ActionTemplateParameterResource[];
}

interface LibraryVariableSetWithVariables {
    variableSet: VariableSetResponse;
    libraryVariableSet: LibraryVariableSetResource;
}

interface AllVariablesForProject {
    projectVariableSet: Omit<VariableSetResource, "ScopeValues"> | undefined;
    libraryVariableSets: LibraryVariableSetWithVariables[];
}

interface GetAllVariablesParams {
    projectId: string;
    gitRef?: string;
    spaceName: string;
    spaceId: string;
}

type VariableSetResponse = Omit<VariableSetResource, "ScopeValues">;

export async function getAllVariables(
    params: GetAllVariablesParams,
    apiClient: Client
): Promise<AllVariablesForProject> {

    const { spaceId, spaceName, gitRef, projectId } = params;

    const projectRepository = new ProjectRepository(apiClient, spaceName);
    const project = await projectRepository.get(projectId);
    const projectVariableSet = await loadProjectVariableSet(project, gitRef, apiClient, spaceId);
    const libraryVariableSets = await loadLibraryVariableSetVariables(project.IncludedLibraryVariableSetIds, apiClient, spaceId);

    return {
        projectVariableSet,
        libraryVariableSets
    };
}

async function loadProjectVariableSet(
    project: Project,
    gitRef: string | undefined,
    apiClient: Client,
    spaceId: string
): Promise<VariableSetResponse | undefined> {

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
        throw new Error(`Missing gitRef for config-as-code project ${project.Name}`);
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

    delete result.ScopeValues;

    return result;
}

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

    const responseVariableSets: VariableSetResponse[] = allVariableSets.map(set => {
        delete set.ScopeValues;
        return set;
    })
    // Create lookup map
    const allVariableSetsMap = responseVariableSets.reduce((acc: ResourcesById<VariableSetResponse>, resource) => {
        acc[resource.Id] = resource;
        return acc;
    }, {});

    // Combine library variable sets with their variable sets
    return libraryVariableSets.Items.map(lvs => ({
        variableSet: allVariableSetsMap[lvs.VariableSetId],
        libraryVariableSet: lvs
    }));
}
