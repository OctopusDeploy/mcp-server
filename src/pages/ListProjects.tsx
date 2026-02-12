import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {App, PostMessageTransport} from "@modelcontextprotocol/ext-apps";
import {useEffect, useState} from "react";
import * as React from "react";
import {SimpleDataTable} from "@octopusdeploy/design-system-components";
import {OctopusIcon} from "@octopusdeploy/design-system-icons";

interface ProjectsProps {
    app: App;
    toolResult: CallToolResult | null;
    hostContext?: PostMessageTransport;
}
export function ListProjects({ app, toolResult }: ProjectsProps) {
    const [projects, setProjects] = useState<OctopusProject[]>([]);
    useEffect(() => {
        if (toolResult) {
            setProjects(extractProjects(toolResult));
        }
    }, [toolResult]);

    return <main style={{ backgroundColor: "#fff" }}>
        <h1><OctopusIcon size={24} />Projects</h1>
        <SimpleDataTable columns={[
            { title: "Project Name", render: (project) => project.name },
            { title: "Project description", render: (project) => project.description },
            { title: "Disabled", render: (project) => project.isDisabled ? "Yes" : "No" },
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

