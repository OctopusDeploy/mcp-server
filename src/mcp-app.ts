// src/mcp-app.ts
import { App } from "@modelcontextprotocol/ext-apps";

const serverTimeEl = document.getElementById("server-time")!;
const getTimeBtn = document.getElementById("get-time-btn")!;

const app = new App({ name: "Get Time App", version: "1.0.0" });

// Establish communication with the host
app.connect();

// Handle the initial tool result pushed by the host
app.ontoolresult = (result) => {
    const time = result.content?.find((c: any) => c.type === "text")?.text;
    serverTimeEl.textContent = time ?? "[ERROR]";
};

// Proactively call tools when users interact with the UI
getTimeBtn.addEventListener("click", async () => {
    const result = await app.callServerTool({
        name: "get_time_ui",
        arguments: {},
    });
    const content = result.content?.find((c: any) => c.type === "text");
    const time = content && content.type === "text" ? content.text : undefined;
    serverTimeEl.textContent = time ?? "[ERROR]";
});