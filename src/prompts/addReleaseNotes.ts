import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAddReleaseNotesPrompt(server: McpServer) {
  server.registerPrompt(
    "add_release_notes",
    {
      title: "Add release notes to an existing Octopus release",
      description:
        "Summarize a set of changes (typically PRs) into a Markdown changelog and write it to an Octopus release. Primary path updates ReleaseNotes on an existing release; falls back to creating a new release if none matches.",
      argsSchema: {
        spaceName: z.string().describe("The Octopus space name (required)"),
        projectName: z.string().describe("The Octopus project name (required)"),
        releaseVersion: z
          .string()
          .optional()
          .describe(
            "Release version to update (optional — omit to be guided through picking from the latest releases, or to fall back to creating a new release)",
          ),
      },
    },
    ({ spaceName, projectName, releaseVersion }) => {
      const versionClause = releaseVersion
        ? ` version **${releaseVersion}**`
        : "";

      const text = `Add release notes to${versionClause ? ` release${versionClause} of` : ""} project **${projectName}** in space **${spaceName}**.

Work through these steps in order. Think step-by-step and check in with the user at each marked decision point.

1. **Gather the change set.** If the user has not already supplied the changes in the surrounding conversation, ask them now. Accept any of:
   - a list of PR titles and/or numbers,
   - commit messages,
   - Jira/Linear ticket summaries,
   - a free-form bullet list of changes the user types out.

   Do not invent changes the user did not provide.

2. **Draft the changelog.** Summarize the change set into Markdown:
   - One \`## {version}\` heading (use \`${releaseVersion ?? "the resolved release version"}\` once it's known).
   - If the input clearly groups into categories (e.g. PR labels like \`feat\`/\`fix\`/\`chore\`), use \`### Features\`, \`### Fixes\`, \`### Chores\` sub-sections. Otherwise emit a flat bullet list.
   - One bullet per change. Sentence-case, present tense, no trailing period. Plain English — no marketing language, no emoji unless the user asked.
   - Bold project, environment, and entity names.
   - Quote any log lines, code, or commands in fenced code blocks.

   Show the draft to the user and **wait for explicit approval** before writing anything back to Octopus.

3. **Find the release.**
   - Resolve \`projectName\` to a project ID with \`list_projects\`.
   - Call \`find_releases\` with the resolved \`projectId\`${releaseVersion ? ` and \`searchByVersion: "${releaseVersion}"\`` : " (and `searchByVersion` if the user supplied a version)"}.
   - If multiple matches come back, or no version was supplied, show the most recent few and ask the user to pick one. If the user says "latest", pick the highest-version assembled release.
   - Confirm the resolved release ID and version back to the user before proceeding.

4. **Fetch the full release body.** The \`find_releases\` summary deliberately omits heavy fields. Call \`read_resource\` with the \`resourceUri\` from step 3 (form: \`octopus://spaces/${spaceName}/releases/{releaseId}\`) to get the full release object — including \`SpaceId\`, \`ProjectId\`, \`ChannelId\`, \`Version\`, \`SelectedPackages\`, \`SelectedGitResources\`, \`CustomFields\`, and the existing \`ReleaseNotes\`.

5. **Update via PUT round-trip.** Octopus's \`PUT /releases/{id}\` endpoint requires the **full** release body back — any field you omit gets wiped. So:
   - Take the object from step 4 exactly as-is.
   - Replace **only** the \`ReleaseNotes\` field with the approved changelog from step 2.
   - Call the \`execute\` tool with \`method: "PUT"\`, \`path: "/api/{SpaceId}/releases/{Id}"\` (use the \`SpaceId\` and \`Id\` from the fetched body), and \`body\` set to the modified object.

   The PUT lands in the write tier, so the MCP client will show a confirmation prompt — this is expected. After confirmation, verify the update by re-reading the release and showing the user that \`ReleaseNotes\` changed while \`SelectedPackages\`, \`ChannelId\`, and other fields stayed the same.

6. **Fallback: release does not exist.** If \`find_releases\` returns no matches, this is the secondary path:
   - Tell the user the release was not found and ask whether to create a new one with the drafted notes.
   - On approval, call \`create_release\` with \`spaceName\`, \`projectName\`, \`releaseVersion\` (ask if not supplied), and \`releaseNotes\` set to the approved changelog. Pass through \`channelName\`, \`gitRef\`, etc. if the user provides them; otherwise let Octopus apply defaults.
   - Be explicit that this is a new release, not an edit to an existing one.

**Gotchas to flag to the user:**
- **Octostache expressions don't re-evaluate.** Variable expressions like \`#{Octopus.Release.Number}\` in release notes are resolved against the variable snapshot at the moment the release is first created. Notes written via PUT are stored literally and not re-evaluated. If the user's draft contains \`#{...}\`, warn them and offer to substitute resolved literal values or strip the expressions.
- **Config-as-Code projects.** \`ReleaseNotes\` is stored on the release server-side, not in the Git repo, so the round-trip works the same way as for database-backed projects.
- **Permissions.** The user needs \`ReleaseEdit\` on the project. A 401/403 from \`execute\` means the API key/account is missing that permission — surface the error directly rather than retrying.

Follow the Octopus Deploy writing guide throughout: concise, direct, plain English. Bold project/release/environment names. Avoid speculation.`;

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
