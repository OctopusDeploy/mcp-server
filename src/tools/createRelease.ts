import {
  Client,
  ReleaseRepository,
  type SelectedPackage,
} from "@octopusdeploy/api-client";
import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClientConfigurationFromEnvironment } from "../helpers/getClientConfigurationFromEnvironment.js";
import { registerToolDefinition } from "../types/toolConfig.js";
import { ADDITIVE_WRITE_TOOL_ANNOTATIONS } from "../types/toolAnnotations.js";
import { handleOctopusApiError } from "../helpers/errorHandling.js";
import {
  requireConfirmation,
  unconfirmedResponse,
} from "../helpers/requireConfirmation.js";

export function registerCreateReleaseTool(server: McpServer) {
  server.registerTool(
    "create_release",
    {
      title: "Create a new release in Octopus Deploy",
      description: `Create a new release for an Octopus Deploy project

This tool creates a new release for a project. The space name and project name are required. All other parameters are optional and will use Octopus defaults if not specified.`,
      inputSchema: {
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
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Required only when the MCP client does not support elicitation. Set to true to confirm release creation; otherwise the tool aborts.",
          ),
      },
      annotations: ADDITIVE_WRITE_TOOL_ANNOTATIONS,
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
      confirm,
    }) => {
      try {
        const summary = [
          `Create release for project ${projectName}`,
          releaseVersion ? `version ${releaseVersion}` : null,
          channelName ? `on channel ${channelName}` : null,
          gitRef ? `from ${gitRef}` : null,
          `in space ${spaceName}`,
        ]
          .filter(Boolean)
          .join(" ");

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

        const confirmation = await requireConfirmation(server, {
          message: `${summary}?`,
          fallbackConfirm: confirm,
          change: { source: {}, target: command },
        });
        if (!confirmation.confirmed) {
          return unconfirmedResponse(confirmation, {
            action: "release creation",
          });
        }

        const configuration = getClientConfigurationFromEnvironment();
        const client = await Client.create(configuration);
        const releaseRepository = new ReleaseRepository(client, spaceName);

        const response = await releaseRepository.create(command);

        // Fetch the persisted Release so we can echo VersionControlReference and
        // the resolved SelectedPackages. The create response only carries the
        // ReleaseId/ReleaseVersion; SelectedPackages comes from the resolved
        // release body and is the single most useful field for the caller to
        // confirm version-template / channel-rule resolution without a second
        // round trip.
        let versionControlReference:
          | { GitRef?: string; GitCommit?: string }
          | undefined;
        let selectedPackages: SelectedPackage[] | undefined;
        try {
          const release = await releaseRepository.get(response.ReleaseId);
          versionControlReference = release.VersionControlReference;
          selectedPackages = release.SelectedPackages;
        } catch {
          versionControlReference = undefined;
          selectedPackages = undefined;
        }

        const encodedSpace = encodeURIComponent(spaceName);
        const encodedId = encodeURIComponent(response.ReleaseId);
        const resourceUri = `octopus://spaces/${encodedSpace}/releases/${encodedId}`;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  releaseId: response.ReleaseId,
                  releaseVersion: response.ReleaseVersion,
                  versionControlReference,
                  selectedPackages,
                  resourceUri,
                  message: `Release ${response.ReleaseVersion} created successfully`,
                  helpText:
                    "selectedPackages shows the resolved package versions bound to this release. Read resourceUri for the full release body (includes releaseNotes). Use deploy_release to deploy this release to environments.",
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
  // ReleaseRepository.create uses the Executions API (~/api/{space}/releases/create/v1)
  // which the api-client refuses to call against servers older than 2022.3.5512.
  minimumOctopusVersion: "2022.3.5512",
});
