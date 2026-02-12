import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {App, PostMessageTransport} from "@modelcontextprotocol/ext-apps";
import {useEffect, useState} from "react";
import * as React from "react";

interface EnvironmentsProps {
    app: App;
    toolResult: CallToolResult | null;
    hostContext?: PostMessageTransport;
}
export function ListEnvironments({ app, toolResult }: EnvironmentsProps) {
    const [environments, setEnvironments] = useState<string[]>([]);
    useEffect(() => {
        if (toolResult) {
            setEnvironments(extractEnvironments(toolResult));
        }
    }, [toolResult]);

    return <main>
        <h1>Environments</h1>
        <ul>
            {environments.map((env) => (
                    <li key={env}>{env}</li>
            ))}
        </ul>
    </main>
}

function extractEnvironments(callToolResult: CallToolResult): string[] {
    const { text } = callToolResult.content?.find((c) => c.type === "text")!;
    return text.split(", ");
}

