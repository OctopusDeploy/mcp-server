import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {App, PostMessageTransport} from "@modelcontextprotocol/ext-apps";
import {useCallback, useEffect, useState} from "react";
import * as React from "react";
import {Button, Callout, SimpleDataTable} from "@octopusdeploy/design-system-components";
import {OctopusIcon} from "@octopusdeploy/design-system-icons";
import {css} from "@emotion/css";
import {space, themeTokens} from "@octopusdeploy/design-system-tokens";

interface ProjectsProps {
    app: App;
    toolResult: CallToolResult | null;
    hostContext?: PostMessageTransport;
}
export function ListProjects({ app, toolResult }: ProjectsProps) {
    const [projects, setProjects] = useState<OctopusProject[]>([]);
    const [releasesInProject, setReleasesInProject] = useState<ReleaseInProject[]>([]);
    useEffect(() => {
        if (toolResult) {
            setProjects(extractProjects(toolResult));
        }
    }, [toolResult]);

    const onClickCreateRelease = useCallback(async (project: OctopusProject) => {
        try {
            // const configuration = getClientConfigurationFromEnvironment();
            // const client = await Client.create(configuration);
            // const releaseRepository = new ReleaseRepository(client, "Default");
            // const response = await releaseRepository.create({
            //     spaceName: "Default",
            //     ProjectName: project.name,
            // });
            //
            const result = await app.callServerTool({ name: "list_releases_for_project", arguments: {spaceName: "Default", projectId: project.id} });
            const { text } = result.content?.find((c) => c.type === "text")!;
            const parsedResult = JSON.parse(text);
            setReleasesInProject(parsedResult.items);
        } catch (e: any) {
            await app.sendLog({level: "error", data: `**** error: ${e.message}`});
            await app.sendLog({level: "error", data: "Failed to create Release"});
        }
    }, [app]);

    return (
        <main className={pageStyles}>
            <h1 className={headerStyles}><OctopusIcon size={24} /><span>Projects</span></h1>
            <SimpleDataTable columns={[
                { title: "Project Name", render: (project) => project.name },
                { title: "Project description", render: (project) => project.description },
                { title: "Disabled", render: (project) => project.isDisabled ? "Yes" : "No" },
                { title: "Actions", render: (project) => <Button importance={"secondary"} label={"Show Releases"} onClick={() => onClickCreateRelease(project)} /> },
            ]} data={projects} getRowKey={(project) => project.id} />
            {
                releasesInProject.length === 0
                    ? <Callout type={"warning"} title={"No releases in project"} />
                    : <Callout type={"information"} title={"Releases in Project"}>
                        <ul>
                            {
                                releasesInProject.map(release => {
                                    return <li key={release.id}>{release.version}</li>
                                })
                            }
                        </ul>
                    </Callout>
            }
        </main>
    )
}

function extractProjects(callToolResult: CallToolResult): OctopusProject[] {
    const { text } = callToolResult.content?.find((c) => c.type === "text")!;
    return JSON.parse(text)["items"];
}

const pageStyles = css({
    color: themeTokens.color.text.primary,
    backgroundColor: themeTokens.color.background.primary.default,
    display: "flex",
    flexDirection: "column",
    gap: space[8],
})

const headerStyles = css({
    display: "flex",
    alignItems: "center",
    gap: space[12],
})

interface OctopusProject {
    spaceId: string;
    id: string;
    name: string;
    description: string;
    slug: string;
    deploymentProcessId: string;
    lifecycleId: string;
    isDisabled: string;
    repositoryUrl: string | null;
}

interface ReleaseInProject {
    id: string;
    version: string;
    channelId: string;
    projectId: string;
    releaseNotes: string;
    assembled: string;
}

