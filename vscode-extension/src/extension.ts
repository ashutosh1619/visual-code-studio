import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * DevCanvas VS Code extension — MVP scaffold.
 *
 * Two commands:
 *   1. `devcanvas.open` — opens the DevCanvas studio inside a webview panel.
 *   2. `devcanvas.importScene` — finds a scene.json in the workspace and
 *      hands it to the studio via postMessage so the canvas pre-loads.
 *
 * The webview is a thin shell: it iframes the studio URL (configurable in
 * settings) and bridges messages so the studio can later request "save back
 * to disk" or "open file in editor". For now we wire the protocol shape
 * but only implement file open + import.
 */

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("devcanvas.open", () => openCanvas(context)),
    vscode.commands.registerCommand("devcanvas.importScene", async () => {
      await openCanvas(context);
      await importSceneIntoPanel();
    }),
  );
}

export function deactivate() {
  panel?.dispose();
  panel = undefined;
}

async function openCanvas(context: vscode.ExtensionContext) {
  const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

  if (panel) {
    panel.reveal(column);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    "devcanvas",
    "DevCanvas",
    column,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  const studioUrl =
    vscode.workspace.getConfiguration("devcanvas").get<string>("studioUrl") ??
    "https://devcanvas.app";

  panel.webview.html = renderShell(studioUrl);

  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg?.type) {
      case "devcanvas:openFile": {
        if (typeof msg.path !== "string") return;
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return;
        const target = vscode.Uri.joinPath(folder.uri, msg.path);
        const doc = await vscode.workspace.openTextDocument(target);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        break;
      }
      case "devcanvas:saveScene": {
        if (typeof msg.json !== "string") return;
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return;
        const target = vscode.Uri.joinPath(folder.uri, "scene.json");
        await vscode.workspace.fs.writeFile(target, Buffer.from(msg.json, "utf8"));
        vscode.window.showInformationMessage("DevCanvas: scene.json saved");
        break;
      }
      case "devcanvas:ready": {
        // Studio finished loading — replay any pending import.
        if (pendingScene) {
          panel?.webview.postMessage({ type: "devcanvas:loadScene", scene: pendingScene });
          pendingScene = null;
        }
        break;
      }
    }
  });

  panel.onDidDispose(() => {
    panel = undefined;
  });
}

let pendingScene: unknown = null;

async function importSceneIntoPanel() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage("Open a folder first.");
    return;
  }

  const candidates = [
    "scene.json",
    "src/generated/scene.json",
    "generated/scene.json",
  ];
  let found: string | undefined;
  for (const c of candidates) {
    const p = path.join(folder.uri.fsPath, c);
    if (fs.existsSync(p)) {
      found = p;
      break;
    }
  }
  if (!found) {
    vscode.window.showWarningMessage(
      "DevCanvas: no scene.json found. Export from the studio and try again.",
    );
    return;
  }

  try {
    const raw = await fs.promises.readFile(found, "utf8");
    const scene = JSON.parse(raw);
    pendingScene = scene;
    panel?.webview.postMessage({ type: "devcanvas:loadScene", scene });
    vscode.window.showInformationMessage(`DevCanvas: loaded ${path.basename(found)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    vscode.window.showErrorMessage(`DevCanvas: failed to load scene — ${msg}`);
  }
}

function renderShell(studioUrl: string): string {
  // The studio runs in an iframe. We wrap it so we can postMessage between
  // the extension host and the studio without coupling the studio's URL
  // origin to the webview's CSP.
  return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevCanvas</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0f0d0b; color: #e9e4d8; font-family: ui-sans-serif, system-ui, sans-serif; }
    #frame { width: 100%; height: 100%; border: 0; display: block; }
    #placeholder {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 8px; pointer-events: none;
    }
    #placeholder p { margin: 0; font-size: 12px; color: #9b9588; }
    #placeholder strong { font-size: 18px; color: #e9e4d8; font-weight: 500; letter-spacing: 0.02em; }
  </style>
</head>
<body>
  <div id="placeholder">
    <strong>DevCanvas</strong>
    <p>Loading studio…</p>
  </div>
  <iframe id="frame" src="${escapeHtml(studioUrl)}" allow="clipboard-read; clipboard-write" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"></iframe>
  <script>
    const vscode = acquireVsCodeApi();
    const frame = document.getElementById("frame");
    const placeholder = document.getElementById("placeholder");

    frame.addEventListener("load", () => {
      placeholder.style.display = "none";
      // Tell the extension host the webview is ready.
      vscode.postMessage({ type: "devcanvas:ready" });
    });

    // Forward studio -> extension messages.
    window.addEventListener("message", (e) => {
      if (!e.data || typeof e.data !== "object") return;
      // Pass through anything namespaced as devcanvas:*
      if (typeof e.data.type === "string" && e.data.type.startsWith("devcanvas:")) {
        vscode.postMessage(e.data);
      }
    });

    // Forward extension -> studio messages into the iframe.
    // VS Code delivers extension messages on the same window.
    window.addEventListener("message", (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (typeof e.data.type === "string" && e.data.type.startsWith("devcanvas:")) {
        try { frame.contentWindow?.postMessage(e.data, "*"); } catch {}
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}
