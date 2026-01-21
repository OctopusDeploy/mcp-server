import { Client, ProjectRepository, type Project } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { projectsDescription } from "../types/projectTypes.js";

export function registerListProjectsTool(server: McpServer) {
  server.tool(
    "list_projects",
    `This tool lists all projects in a given space. ${projectsDescription} The space name is required, if you can't find the space name, ask the user directly for the name of the space. Optionally filter by partial name match using partialName parameter.`,
    {
      spaceName: z.string(), 
      partialName: z.string().optional(),
      skip: z.number().optional(),
      take: z.number().optional()
    },
    {
      title: "List all projects in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, partialName, skip, take }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const projectRepository = new ProjectRepository(client, spaceName);

      const projectsResponse = await projectRepository.list({ partialName, skip, take });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalResults: projectsResponse.TotalResults,
              itemsPerPage: projectsResponse.ItemsPerPage,
              numberOfPages: projectsResponse.NumberOfPages,
              lastPageNumber: projectsResponse.LastPageNumber,
              items: projectsResponse.Items.map((project: Project) => ({
                spaceId: project.SpaceId,
                id: project.Id,
                name: project.Name,
                description: project.Description,
                slug: project.Slug,
                deploymentProcessId: project.DeploymentProcessId,
                lifecycleId: project.LifecycleId,
                isDisabled: project.IsDisabled,
                repositoryUrl:
                  project.PersistenceSettings.Type === "VersionControlled"
                    ? project.PersistenceSettings.Url
                    : null,
              })),
            }),
          },
        ],
      };
    }
  );
}

registerToolDefinition({
  toolName: "list_projects",
  config: { toolset: "projects", readOnly: true },
  registerFn: registerListProjectsTool,
});