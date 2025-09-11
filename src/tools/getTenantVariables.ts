import { Client, TenantRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";

export function registerGetTenantVariablesTool(server: McpServer) {
  server.tool(
    "get_tenant_variables",
    `Get tenant variables by type
  
  This tool retrieves different types of tenant variables. Use variableType parameter to specify which type:
  - "all": Get all tenant variables
  - "common": Get common variables only
  - "project": Get project-specific variables only`,
    { 
      spaceName: z.string().describe("The space name"),
      tenantId: z.string().describe("The ID of the tenant to retrieve variables for"),
      variableType: z.enum(["all", "common", "project"]).describe("Type of variables to retrieve"),
      includeMissingVariables: z.boolean().optional().describe("Include missing variables in the response (for common/project types)")
    },
    {
      title: "Get tenant variables from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ spaceName, tenantId, variableType, includeMissingVariables = false }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const tenantRepository = new TenantRepository(client, spaceName);

      let variables;
      
      switch (variableType) {
        case "all":
          const tenant = await tenantRepository.get(tenantId);
          variables = await tenantRepository.getVariables(tenant);
          break;
        case "common":
          variables = await tenantRepository.getCommonVariablesById(tenantId, includeMissingVariables);
          break;
        case "project":
          variables = await tenantRepository.getProjectVariablesById(tenantId, includeMissingVariables);
          break;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              tenantId,
              variableType,
              includeMissingVariables,
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
  registerFn: registerGetTenantVariablesTool
});