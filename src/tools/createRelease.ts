import { Client, ReleaseRepository } from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";

export function registerCreateReleaseTool(server: McpServer) {
  server.tool(
    "create_release",
    `Create a new release for an Octopus Deploy project

This tool creates a new release for a project. The space name and project name are required. All other parameters are optional and will use Octopus defaults if not specified.`,
    {
      spaceName: z.string().describe("The space name"),
      projectName: z.string().describe("The project name"),
      releaseVersion: z
        .string()
        .optional()
        .describe(
          "The version for the release (e.g., '1.0.0'). If not specified, Octopus will auto-generate based on project settings.",
        ),
      channelName: z
        .string()
        .optional()
        .describe("The channel name (uses default channel if not specified)"),
      packageVersion: z
        .string()
        .optional()
        .describe("Default package version to use for all packages"),
      packages: z
        .array(z.string())
        .optional()
        .describe(
          "Array of package specifications (format depends on Octopus configuration)",
        ),
      gitCommit: z.string().optional().describe("Git commit hash"),
      gitRef: z.string().optional().describe("Git reference (branch or tag)"),
      releaseNotes: z
        .string()
        .optional()
        .describe("Release notes for this release"),
      ignoreIfAlreadyExists: z
        .boolean()
        .optional()
        .describe(
          "If true, skip creation if release already exists (returns existing release)",
        ),
      ignoreChannelRules: z
        .boolean()
        .optional()
        .describe("If true, ignore channel version rules"),
      packagePrerelease: z
        .string()
        .optional()
        .describe("Package prerelease tag"),
      customFields: z
        .record(z.string())
        .optional()
        .describe("Custom field values as key-value pairs"),
    },
    {
      title: "Create a new release in Octopus Deploy",
      readOnlyHint: false,
    },
    async ({
      spaceName,
      projectName,
      releaseVersion,
      channelName,
      packageVersion,
      packages,
      gitCommit,
      gitRef,
      releaseNotes,
      ignoreIfAlreadyExists,
      ignoreChannelRules,
      packagePrerelease,
      customFields,
    }) => {
      try {
        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const releaseRepository = new ReleaseRepository(client, spaceName);

        const command = {
          spaceName: spaceName,
          ProjectName: projectName,
          ...(releaseVersion && { ReleaseVersion: releaseVersion }),
          ...(channelName && { ChannelName: channelName }),
          ...(packageVersion && { PackageVersion: packageVersion }),
          ...(packages && { Packages: packages }),
          ...(gitCommit && { GitCommit: gitCommit }),
          ...(gitRef && { GitRef: gitRef }),
          ...(releaseNotes && { ReleaseNotes: releaseNotes }),
          ...(ignoreIfAlreadyExists !== undefined && {
            IgnoreIfAlreadyExists: ignoreIfAlreadyExists,
          }),
          ...(ignoreChannelRules !== undefined && {
            IgnoreChannelRules: ignoreChannelRules,
          }),
          ...(packagePrerelease && { PackagePrerelease: packagePrerelease }),
          ...(customFields && { CustomFields: customFields }),
        };

        const response = await releaseRepository.create(command);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  releaseId: response.ReleaseId,
                  releaseVersion: response.ReleaseVersion,
                  message: `Release ${response.ReleaseVersion} created successfully`,
                  helpText:
                    "Use get_release_by_id or list_releases_for_project to view release details, or use deploy_release to deploy this release to environments.",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        handleOctopusApiError(error, {
          entityType: "release",
          spaceName,
          helpText:
            "Use list_projects to find valid project names. Ensure you have permissions to create releases and that the project exists.",
        });
      }
    },
  );
}

registerToolDefinition({
  toolName: "create_release",
  config: { toolset: "releases", readOnly: false },
  registerFn: registerCreateReleaseTool,
});
