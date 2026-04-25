import JSZip from "jszip";
import type { Scene, CanvasNode, Page, DesignTokens } from "./scene";

const componentName = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("") || "Page";

const styleObject = (n: CanvasNode): string => {
  const s = n.style;
  const parts: string[] = [];
  parts.push(`position:'absolute'`);
  parts.push(`left:'${Math.round(n.position.x)}px'`);
  parts.push(`top:'${Math.round(n.position.y)}px'`);
  parts.push(`width:'${n.size.width}px'`);
  parts.push(`height:'${n.size.height}px'`);
  if (s.background) parts.push(`background:'${s.background}'`);
  if (s.color) parts.push(`color:'${s.color}'`);
  if (s.borderRadius) parts.push(`borderRadius:'${s.borderRadius}px'`);
  if (s.borderWidth) parts.push(`border:'${s.borderWidth}px solid ${s.borderColor ?? "#000"}'`);
  if (s.padding) parts.push(`padding:'${s.padding}px'`);
  if (s.fontSize) parts.push(`fontSize:'${s.fontSize}px'`);
  if (s.fontWeight) parts.push(`fontWeight:${s.fontWeight}`);
  if (s.display) parts.push(`display:'${s.display}'`);
  if (s.flexDirection) parts.push(`flexDirection:'${s.flexDirection}'`);
  if (s.alignItems) parts.push(`alignItems:'${s.alignItems === "start" ? "flex-start" : s.alignItems === "end" ? "flex-end" : s.alignItems}'`);
  if (s.justifyContent)
    parts.push(`justifyContent:'${s.justifyContent === "start" ? "flex-start" : s.justifyContent === "end" ? "flex-end" : s.justifyContent === "between" ? "space-between" : s.justifyContent}'`);
  return `{${parts.join(", ")}}`;
};

const renderNode = (n: CanvasNode, indent = 6): string => {
  const pad = " ".repeat(indent);
  const style = ` style={${styleObject(n)}}`;
  const safe = (s?: string) => (s ?? "").replace(/[<>]/g, "");
  switch (n.type) {
    case "text":
      return `${pad}<p${style}>${safe(n.content)}</p>`;
    case "button":
      return `${pad}<button${style}>${safe(n.content)}</button>`;
    case "input":
      return `${pad}<input${style} placeholder="${safe(n.content)}" />`;
    case "image":
      return n.src
        ? `${pad}<img${style} src="${n.src}" alt="" />`
        : `${pad}<div${style} role="img" aria-label="image" />`;
    case "box":
    default:
      return `${pad}<div${style} />`;
  }
};

const pageComponent = (page: Page, nodes: CanvasNode[]) => {
  const sorted = nodes.filter((n) => n.pageId === page.id).sort((a, b) => a.zIndex - b.zIndex);
  const body = sorted.map((n) => renderNode(n, 6)).join("\n");
  const safeName = componentName(page.name);
  return `// ${page.name} — ${page.breakpoint ?? "mobile"}
export default function ${safeName}() {
  return (
    <div style={{ position: 'relative', width: ${page.size.width}, height: ${page.size.height}, background: '${page.background ?? "#0f0d0b"}', margin: '0 auto' }}>
${body}
    </div>
  );
}
`;
};

const routeName = (page: Page, idx: number) => {
  if (idx === 0) return "/";
  return "/" + page.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
};

const indexHtml = (projectName: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const packageJson = (projectName: string) =>
  JSON.stringify(
    {
      name: projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc -b && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^6.26.0",
      },
      devDependencies: {
        "@types/react": "^18.3.0",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.0",
        autoprefixer: "^10.4.0",
        postcss: "^8.4.0",
        tailwindcss: "^3.4.0",
        typescript: "^5.5.0",
        vite: "^5.4.0",
      },
    },
    null,
    2,
  );

const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
`;

const tsconfig = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`;

const tailwindConfig = (tokens: DesignTokens) => `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '${tokens.colors.background}',
        foreground: '${tokens.colors.foreground}',
        muted: '${tokens.colors.muted}',
        accent: '${tokens.colors.accent}',
        border: '${tokens.colors.border}',
        surface: '${tokens.colors.surface}',
      },
      fontFamily: {
        display: ${JSON.stringify(tokens.typography.displayFamily.split(",").map((s) => s.trim()))},
        body: ${JSON.stringify(tokens.typography.bodyFamily.split(",").map((s) => s.trim()))},
      },
      borderRadius: { DEFAULT: '${tokens.radius}px' },
    },
  },
  plugins: [],
};
`;

const postcssConfig = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`;

const indexCss = (tokens: DesignTokens) => `@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: ${tokens.theme}; }
html, body { background: ${tokens.colors.background}; color: ${tokens.colors.foreground}; font-family: ${tokens.typography.bodyFamily}; }
`;

const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

const appTsx = (pages: Page[]) => {
  const imports = pages
    .map((p, i) => `import ${componentName(p.name)} from './pages/${componentName(p.name)}';`)
    .join("\n");
  const links = pages
    .map((p, i) => `        <li><Link to="${routeName(p, i)}">${p.name}</Link></li>`)
    .join("\n");
  const routes = pages
    .map((p, i) => `        <Route path="${routeName(p, i)}" element={<${componentName(p.name)} />} />`)
    .join("\n");
  return `import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
${imports}

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: 16, borderBottom: '1px solid #2a2622', display: 'flex', gap: 16 }}>
        <strong>Generated by DevCanvas</strong>
        <ul style={{ display: 'flex', gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
${links}
        </ul>
      </nav>
      <Routes>
${routes}
      </Routes>
    </BrowserRouter>
  );
}
`;
};

const readme = (projectName: string) => `# ${projectName}

Generated by **DevCanvas** — UI is the source of truth.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`
`;

export const exportSceneAsZip = async (scene: Scene, projectName = "devcanvas-app"): Promise<Blob> => {
  const zip = new JSZip();
  zip.file("package.json", packageJson(projectName));
  zip.file("vite.config.ts", viteConfig);
  zip.file("tsconfig.json", tsconfig);
  zip.file("tailwind.config.js", tailwindConfig(scene.tokens));
  zip.file("postcss.config.js", postcssConfig);
  zip.file("index.html", indexHtml(projectName));
  zip.file("README.md", readme(projectName));
  zip.file(".gitignore", "node_modules\ndist\n.env\n");

  const src = zip.folder("src")!;
  src.file("main.tsx", mainTsx);
  src.file("index.css", indexCss(scene.tokens));
  src.file("App.tsx", appTsx(scene.pages));

  const pagesFolder = src.folder("pages")!;
  scene.pages.forEach((page) => {
    pagesFolder.file(`${componentName(page.name)}.tsx`, pageComponent(page, scene.nodes));
  });

  return zip.generateAsync({ type: "blob" });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
