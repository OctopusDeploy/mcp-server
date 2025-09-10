import { Client, TenantRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";

export function registerGetMissingTenantVariablesTool(server: McpServer) {
  server.tool(
    "get_missing_tenant_variables",
    `Get missing tenant variables
  
  This tool retrieves tenant variables that are missing values. Optionally filter by tenant, project, or environment.`,
    { 
      space: z.string().describe("The space name"),
      tenantId: z.string().optional().describe("Filter by specific tenant ID"),
      projectId: z.string().optional().describe("Filter by specific project ID"),
      environmentId: z.string().optional().describe("Filter by specific environment ID"),
      includeDetails: z.boolean().optional().describe("Include detailed information about missing variables")
    },
    {
      title: "Get missing tenant variables from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ space, tenantId, projectId, environmentId, includeDetails = false }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const tenantRepository = new TenantRepository(client, space);

      const filterOptions = {
        tenantId,
        projectId,
        environmentId
      };

      const missingVariables = await tenantRepository.missingVariables(filterOptions, includeDetails);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              filters: filterOptions,
              includeDetails,
              missingVariables
            }),
          },
        ],
      };
    }
  );
}