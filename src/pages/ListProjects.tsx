import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {App, PostMessageTransport} from "@modelcontextprotocol/ext-apps";
import {useEffect, useState} from "react";
import * as React from "react";

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
        <h1>Projects</h1>
        <ul>
            {projects.map((project) => (
                    <li key={project.slug}>{project.name}</li>
            ))}
        </ul>
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

