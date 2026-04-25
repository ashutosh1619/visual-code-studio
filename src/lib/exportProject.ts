// Bundle the current scene into a downloadable Vite + React + Tailwind project.
import JSZip from "jszip";
import type { CanvasNode, Page, Edge } from "./scene";
import { generateCode } from "./codegen";

interface ExportInput {
  pages: Page[];
  nodes: CanvasNode[];
  edges: Edge[];
  projectName?: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "devcanvas-project";

const PACKAGE_JSON = (name: string) =>
  JSON.stringify(
    {
      name,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
      devDependencies: {
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.1",
        autoprefixer: "^10.4.19",
        postcss: "^8.4.39",
        tailwindcss: "^3.4.6",
        typescript: "^5.5.3",
        vite: "^5.4.0",
      },
    },
    null,
    2,
  );

const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;

const TS_CONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2020",
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      isolatedModules: true,
      noEmit: true,
    },
    include: ["src"],
  },
  null,
  2,
);

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`;

const POSTCSS_CONFIG = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
`;

const INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}
body {
  margin: 0;
  background: #0f0d0b;
  color: #e9e4d8;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
`;

const INDEX_HTML = (name: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const MAIN_TSX = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;

const APP_TSX = (pages: Page[]) => {
  const componentName = (name: string) =>
    name
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("") || "Page";

  if (pages.length === 0) {
    return `import GeneratedPage from "./generated/Pages";

export default function App() {
  return <GeneratedPage />;
}
`;
  }

  const imports = pages.map((p) => componentName(p.name));
  return `import { ${imports.join(", ")} } from "./generated/Pages";
import { useState } from "react";

const tabs = [
${pages.map((p) => `  { name: ${JSON.stringify(p.name)}, Comp: ${componentName(p.name)} }`).join(",\n")},
];

export default function App() {
  const [active, setActive] = useState(0);
  const Active = tabs[active].Comp;
  return (
    <div style={{ minHeight: "100vh", background: "#0f0d0b", color: "#e9e4d8" }}>
      <nav style={{ display: "flex", gap: 8, padding: 16, borderBottom: "1px solid #2a2622" }}>
        {tabs.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setActive(i)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid " + (i === active ? "#d49a3e" : "#2a2622"),
              background: i === active ? "#d49a3e" : "transparent",
              color: i === active ? "#1a1714" : "#e9e4d8",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {t.name}
          </button>
        ))}
      </nav>
      <main style={{ padding: 24 }}><Active /></main>
    </div>
  );
}
`;
};

const README = (name: string, pages: Page[], edges: Edge[]) => `# ${name}

Exported from **DevCanvas** — UI is the source of truth.

## Structure

- ${pages.length} page${pages.length === 1 ? "" : "s"}
- ${edges.length} flow connection${edges.length === 1 ? "" : "s"}

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

## Pages

${pages.map((p) => `- **${p.name}** (${p.size.width}×${p.size.height})`).join("\n")}

## Notes

The generated components in \`src/generated/Pages.tsx\` use absolute positioning to mirror the canvas layout exactly. Refactor freely — wire in data, validation, and routing. GitHub Copilot or Cursor work well for the next pass.
`;

const GITIGNORE = `node_modules
dist
.env
.DS_Store
`;

export const buildProjectZip = async (input: ExportInput): Promise<Blob> => {
  const name = slug(input.projectName ?? "devcanvas-project");
  const zip = new JSZip();
  const root = zip.folder(name)!;

  root.file("package.json", PACKAGE_JSON(name));
  root.file("vite.config.ts", VITE_CONFIG);
  root.file("tsconfig.json", TS_CONFIG);
  root.file("tailwind.config.js", TAILWIND_CONFIG);
  root.file("postcss.config.js", POSTCSS_CONFIG);
  root.file("index.html", INDEX_HTML(name));
  root.file(".gitignore", GITIGNORE);
  root.file("README.md", README(name, input.pages, input.edges));

  const src = root.folder("src")!;
  src.file("main.tsx", MAIN_TSX);
  src.file("index.css", INDEX_CSS);
  src.file("App.tsx", APP_TSX(input.pages));

  const generated = src.folder("generated")!;
  generated.file("Pages.tsx", generateCode(input.nodes, input.pages));

  // Stash the raw scene so users can re-import later.
  generated.file(
    "scene.json",
    JSON.stringify({ pages: input.pages, nodes: input.nodes, edges: input.edges }, null, 2),
  );

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
};

export const downloadProjectZip = async (input: ExportInput) => {
  const blob = await buildProjectZip(input);
  const name = slug(input.projectName ?? "devcanvas-project");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
};
