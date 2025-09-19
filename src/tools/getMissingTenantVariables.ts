import { Client, TenantRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { validateEntityId, handleOctopusApiError, ENTITY_PREFIXES } from "../helpers/errorHandling.js";

export function registerGetMissingTenantVariablesTool(server: McpServer) {
  server.tool(
    "get_missing_tenant_variables",
    `Get missing tenant variables
  
  This tool retrieves tenant variables that are missing values. Optionally filter by tenant, project, or environment.`,
    { 
      spaceName: z.string().describe("The space name"),
      tenantId: z.string().optional().describe("Filter by specific tenant ID"),
      projectId: z.string().optional().describe("Filter by specific project ID"),
      environmentId: z.string().optional().describe("Filter by specific environment ID"),
      includeDetails: z.boolean().optional().describe("Include detailed information about missing variables")
    },
    {
      title: "Get missing tenant variables from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ spaceName, tenantId, projectId, environmentId, includeDetails = false }) => {
      if (tenantId) {
        validateEntityId(tenantId, 'tenant', ENTITY_PREFIXES.tenant);
      }
      if (projectId) {
        validateEntityId(projectId, 'project', ENTITY_PREFIXES.project);
      }
      if (environmentId) {
        validateEntityId(environmentId, 'environment', ENTITY_PREFIXES.environment);
      }

      const filterOptions = {
        tenantId,
        projectId,
        environmentId
      };

      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const tenantRepository = new TenantRepository(client, spaceName);

        const missingVariables = await tenantRepository.missingVariables(filterOptions, includeDetails);

        if (!missingVariables || (Array.isArray(missingVariables) && missingVariables.length === 0)) {
          const filterDescription = Object.entries(filterOptions)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ') || 'no filters';

          return {
            content: [
              {
                type: "text",
                text: `No missing tenant variables found with filters: ${filterDescription}. All required variables appear to be configured.`,
              },
            ],
          };
        }

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
      } catch (error) {
        handleOctopusApiError(error, { spaceName });
      }
    }
  );
}

registerToolDefinition({
  toolName: "get_missing_tenant_variables",
  config: { toolset: "tenants", readOnly: true },
  registerFn: registerGetMissingTenantVariablesTool,
});