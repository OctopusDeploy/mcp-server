import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as React from "react";
// @ts-ignore
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function extractTime(callToolResult: CallToolResult): string {
    const { text } = callToolResult.content?.find((c) => c.type === "text")!;
    return text;
}


function GetTimeApp() {
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

    return <GetTimeAppInner app={app} toolResult={toolResult} hostContext={hostContext} />;
}

interface GetTimeAppInnerProps {
    app: App;
    toolResult: CallToolResult | null;
    hostContext?: PostMessageTransport;
}
function GetTimeAppInner({ app, toolResult, hostContext }: GetTimeAppInnerProps) {
    const [serverTime, setServerTime] = useState("Loading...");
    const [messageText, setMessageText] = useState("This is message text.");
    const [logText, setLogText] = useState("This is log text.");
    const [linkUrl, setLinkUrl] = useState("https://modelcontextprotocol.io/");

    useEffect(() => {
        if (toolResult) {
            setServerTime(extractTime(toolResult));
        }
    }, [toolResult]);

    const handleGetTime = useCallback(async () => {
        try {
            console.info("Calling get-time tool...");
            const result = await app.callServerTool({ name: "get_time_ui", arguments: {} });
            console.info("get-time result:", result);
            setServerTime(extractTime(result));
        } catch (e) {
            console.error(e);
            setServerTime("[ERROR]");
        }
    }, [app]);

    const handleSendMessage = useCallback(async () => {
        const signal = AbortSignal.timeout(5000);
        try {
            console.info("Sending message text to Host:", messageText);
            const { isError } = await app.sendMessage(
                { role: "user", content: [{ type: "text", text: messageText }] },
                { signal },
            );
            console.info("Message", isError ? "rejected" : "accepted");
        } catch (e) {
            console.error("Message send error:", signal.aborted ? "timed out" : e);
        }
    }, [app, messageText]);

    const handleSendLog = useCallback(async () => {
        console.info("Sending log text to Host:", logText);
        await app.sendLog({ level: "info", data: logText });
    }, [app, logText]);

    const handleOpenLink = useCallback(async () => {
        console.info("Sending open link request to Host:", linkUrl);
        const { isError } = await app.openLink({ url: linkUrl });
        console.info("Open link request", isError ? "rejected" : "accepted");
    }, [app, linkUrl]);

    return (
        <main style={{ background: "yellow" }}>
            <p>Watch activity in the DevTools console!</p>
            <div>
                <p>
                    <strong>Server Time:</strong> <code>{serverTime}</code>
                </p>
                <button onClick={handleGetTime}>Get Server Time</button>
            </div>

            <div>
                <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} />
                <button onClick={handleSendMessage}>Send Message</button>
            </div>

            <div>
                <input type="text" value={logText} onChange={(e) => setLogText(e.target.value)} />
                <button onClick={handleSendLog}>Send Log</button>
            </div>

            <div>
                <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                <button onClick={handleOpenLink}>Open Link</button>
            </div>
        </main>
    );
}


createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <GetTimeApp />
    </StrictMode>,
);