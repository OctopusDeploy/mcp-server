import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDiagnoseDeploymentFailurePrompt(server: McpServer) {
  server.registerPrompt(
    "diagnose_deployment_failure",
    {
      title: "Diagnose a failed deployment or runbook run",
      description:
        "Analyze and summarize a failed Octopus Deploy deployment or runbook run, calling out what went wrong and suggesting how to fix it.",
      argsSchema: {
        spaceName: z.string().describe("The Octopus space name (required)"),
        projectName: z.string().describe("The Octopus project name (required)"),
        releaseVersion: z
          .string()
          .optional()
          .describe(
            "Release version to diagnose (optional — omit for the latest failed deployment, or when diagnosing a runbook run)",
          ),
        runbookName: z
          .string()
          .optional()
          .describe(
            "Runbook name to diagnose (optional — supply when diagnosing a failed runbook run rather than a deployment)",
          ),
      },
    },
    ({ spaceName, projectName, releaseVersion, runbookName }) => {
      const isRunbook = Boolean(runbookName);
      const subject = isRunbook ? "runbook run" : "deployment";

      const qualifiers: string[] = [];
      if (runbookName) qualifiers.push(`runbook **${runbookName}**`);
      if (releaseVersion) qualifiers.push(`release **${releaseVersion}**`);
      const qualifierClause =
        qualifiers.length > 0 ? ` (${qualifiers.join(", ")})` : "";

      const text = `Diagnose the most recent failed ${subject} for project **${projectName}** in space **${spaceName}**${qualifierClause}.

Follow this diagnostic approach, thinking step-by-step:
1. Identify the exact step/target where failure occurred.
2. Extract and quote the specific error message(s) from the task log.
3. Determine the error category (configuration, connectivity, permissions, resource availability, etc.).
4. Provide actionable remediation steps based on the error type.
5. Note any cascading failures that resulted from the primary issue.

Suggested tools on this MCP server:
- \`${isRunbook ? "find_runbooks" : "find_releases"}\` and \`list_deployments\` to locate the failed task.
- \`get_task_from_url\` or \`get_deployment_from_url\` if the user supplies a URL.
- \`read_resource\` against \`octopus://spaces/{spaceName}/tasks/{taskId}/details\` for the structured activity tree (steps, targets, timing).
- \`grep_task_log\` to search the raw log with GNU-grep semantics — prefer this over reading whole logs.
- \`find_events\` for surrounding audit context (who triggered what, when).
- When a parent task references child sub-deployments (e.g. \`Deploy a Release\` steps), drill into the failed child task with the same tools to retrieve the actual error.

Remember: releases in Octopus snapshot the deployment process and variables at creation time. Changes made afterwards do not affect existing releases — fixes usually require creating a new release.

Follow the Octopus Deploy writing guide: be concise, direct, and use plain English. Bold step/project/entity names, quote log lines in code blocks, and avoid speculation about manually-cancelled tasks.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text,
            },
          },
        ],
      };
    },
  );
}
