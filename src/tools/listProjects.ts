import { Client, ProjectRepository, type Project } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { projectsDescription } from "../types/projectTypes.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";

export function registerListProjectsTool(server: McpServer) {
  server.tool(
    "list_projects",
    `This tool lists all projects in a given space. ${projectsDescription} The space name is required, if you can't find the space name, ask the user directly for the name of the space. Optionally filter by partial name match using partialName parameter.`,
    { spaceName: z.string(), partialName: z.string().optional() },
    {
      title: "List all projects in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ spaceName, partialName }) => {
      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const projectRepository = new ProjectRepository(client, spaceName);

        const projectsResponse = await projectRepository.list({ partialName });
        const projects = projectsResponse.Items.map((project: Project) => ({
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
        }));

        if (projects.length === 0) {
          const message = partialName
            ? `No projects found matching '${partialName}' in space '${spaceName}'. Project names are case-sensitive.`
            : `No projects found in space '${spaceName}'. This space may be empty or you may not have permission to view projects.`;

          return {
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(projects),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, { spaceName });
      }
    }
  );
}

registerToolDefinition({
  toolName: "list_projects",
  config: { toolset: "projects", readOnly: true },
  registerFn: registerListProjectsTool,
});