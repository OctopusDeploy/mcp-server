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
    const [projects, setProjects] = useState<string[]>([]);
    useEffect(() => {
        if (toolResult) {
            setProjects(extractProjects(toolResult));
        }
    }, [toolResult]);

    return <main>
        <h1>Projects</h1>
        <ul>
            {projects.map((project) => (
                    <li key={project}>{project}</li>
            ))}
        </ul>
    </main>
}

function extractProjects(callToolResult: CallToolResult): string[] {
    const { text } = callToolResult.content?.find((c) => c.type === "text")!;
    return text.split(", ");
}

