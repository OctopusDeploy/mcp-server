import { Client, ProjectRepository, type Project } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";

export function registerListProjectsTool(server: McpServer) {
  server.tool(
    "list_projects",
    `List projects in a space
  
  This tool lists all projects in a given space. The space name is required, if you can't find the space name, ask the user directly for the name of the space. Optionally filter by partial name match using partialName parameter.`,
    { space: z.string(), partialName: z.string().optional() },
    {
      title: "List all projects in an Octopus Deploy space",
      readOnlyHint: true,
    },
    async ({ space, partialName }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const projectRepository = new ProjectRepository(client, space);

      const projectsResponse = await projectRepository.list({ partialName });
      const projects = projectsResponse.Items.map((project: Project) => ({
        spaceId: project.SpaceId,
        id: project.Id,
        name: project.Name,
        description: project.Description,
        slug: project.Slug,
        repositoryUrl:
          project.PersistenceSettings.Type === "VersionControlled"
            ? project.PersistenceSettings.Url
            : null,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(projects),
          },
        ],
      };
    }
  );
}