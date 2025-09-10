import { Client, ObservabilityRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";

export function registerGetKubernetesLiveStatusTool(server: McpServer) {
  server.tool(
    "get_kubernetes_live_status",
    `Get Kubernetes live status for a project and environment
  
  This tool retrieves the live status of Kubernetes resources for a specific project and environment. Optionally include a tenant ID for multi-tenant deployments.`,
    { 
      space: z.string().describe("The space name"),
      projectId: z.string().describe("The ID of the project"),
      environmentId: z.string().describe("The ID of the environment"),
      tenantId: z.string().optional().describe("The ID of the tenant (for multi-tenant deployments)"),
      includeDetails: z.boolean().optional().describe("Include detailed information")
    },
    {
      title: "Get Kubernetes live status from Octopus Deploy",
      readOnlyHint: true,
    },
    async ({ space, projectId, environmentId, tenantId, includeDetails = false }) => {
      const configuration = getClientConfigurationFromEnvironment();
      const client = await Client.create(configuration);
      const observabilityRepository = new ObservabilityRepository(client, space);

      const liveStatus = await observabilityRepository.getLiveStatus(
        projectId,
        environmentId,
        tenantId,
        !includeDetails
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              projectId,
              environmentId,
              tenantId,
              summaryOnly: !includeDetails,
              liveStatus: {
                machineStatuses: liveStatus.MachineStatuses?.map((machine: any) => ({
                  machineId: machine.MachineId,
                  status: machine.Status,
                  resources: machine.Resources?.map((resource: any) => ({
                    name: resource.Name,
                    namespace: resource.Namespace,
                    kind: resource.Kind,
                    healthStatus: resource.HealthStatus,
                    syncStatus: resource.SyncStatus,
                    machineId: resource.MachineId,
                    children: resource.Children,
                    desiredResourceId: resource.DesiredResourceId,
                    resourceId: resource.ResourceId
                  }))
                })),
                summary: liveStatus.Summary ? {
                  status: liveStatus.Summary.Status,
                  lastUpdated: liveStatus.Summary.LastUpdated
                } : undefined
              }
            }),
          },
        ],
      };
    }
  );
}