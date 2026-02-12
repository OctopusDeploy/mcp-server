import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {App, PostMessageTransport} from "@modelcontextprotocol/ext-apps";
import {useCallback, useEffect, useState} from "react";
import * as React from "react";
import {Button, Callout, SimpleDataTable} from "@octopusdeploy/design-system-components";
import {OctopusIcon} from "@octopusdeploy/design-system-icons";

interface ProjectsProps {
    app: App;
    toolResult: CallToolResult | null;
    hostContext?: PostMessageTransport;
}
export function ListProjects({ app, toolResult }: ProjectsProps) {
    const [projects, setProjects] = useState<OctopusProject[]>([]);
    const [releaseCreated, setReleaseCreated] = useState<string>("");
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
            const result = await app.callServerTool({ name: "create_release", arguments: {spaceName: "Default", projectName: project.name} });
            const { text } = result.content?.find((c) => c.type === "text")!;
            const parsedResult = JSON.parse(text);
            await app.sendLog({level: "info", data: `*** Created ${parsedResult["releaseId"]}`});
            setReleaseCreated(text);
        } catch (e: any) {
            await app.sendLog({level: "error", data: `**** error: ${e.message}`});
            await app.sendLog({level: "error", data: "Failed to create Release"});
        }
    }, [app]);

    return <main>
        <h1><OctopusIcon size={24} /><span>Projects</span></h1>
        {releaseCreated && (<Callout type={"success"} title={`Release ${releaseCreated} created`} /> )}
        <SimpleDataTable columns={[
            { title: "Project Name", render: (project) => project.name },
            { title: "Project description", render: (project) => project.description },
            { title: "Disabled", render: (project) => project.isDisabled ? "Yes" : "No" },
            { title: "Actions", render: (project) => <Button importance={"secondary"} label={"Create Release"} onClick={() => onClickCreateRelease(project)} /> },
        ]} data={projects} getRowKey={(project) => project.id} />
    </main>
}

function extractProjects(callToolResult: CallToolResult): OctopusProject[] {
    const { text } = callToolResult.content?.find((c) => c.type === "text")!;
    return JSON.parse(text)["items"];
}

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

