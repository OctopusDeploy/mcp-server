import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as React from "react";
// @ts-ignore
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import {ListEnvironments} from "./pages/ListEnvironments.js";
import {ListProjects} from "./pages/ListProjects.js";

function OctopusMcpApp() {
    const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
    const [hostContext, setHostContext] = useState<PostMessageTransport | undefined>();

    // `useApp` (1) creates an `App` instance, (2) calls `onAppCreated` to
    // register handlers, and (3) calls `connect()` on the `App` instance.
    const { app, error } = useApp({
        appInfo: { name: "Get Time App", version: "1.0.0" },
        capabilities: {},
        onAppCreated: (app: App) => {
            app.onteardown = async () => {
                console.info("App is being torn down");
                return {};
            };
            app.ontoolinput = async (input) => {
                console.info("Received tool call input:", input);
            };

            app.ontoolresult = async (result) => {
                console.info("Received tool call result:", result);
                await app.sendLog({level: "info", data: `***  result received: ${result[0]}`})
                setToolResult(result);
            };

            app.ontoolcancelled = (params) => {
                console.info("Tool call cancelled:", params.reason);
            };

            app.onerror = console.error;

            app.onhostcontextchanged = (params) => {
                setHostContext((prev: PostMessageTransport["params"]) => ({ ...prev, ...params }));
            };
        },
    });

    useEffect(() => {
        if (app) {
            setHostContext(app.getHostContext());
        }
    }, [app]);

    if (error) return <div><strong>ERROR:</strong> {error.message}</div>;
    if (!app) return <div>Connecting...</div>;


    switch (toolResult?.type) {
        case "list_environments":
            return <ListEnvironments app={app} toolResult={toolResult} hostContext={hostContext} />;
        case "list_projects":
            return <ListProjects app={app} toolResult={toolResult} hostContext={hostContext} />;
        default:
            return <div>Waiting data....</div>
    }

}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <OctopusMcpApp />
    </StrictMode>,
);