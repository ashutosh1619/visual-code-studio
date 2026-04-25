import type { Page, CanvasNode, Edge, NodeType } from "./scene";
import { defaultStyleFor, defaultSizeFor } from "./scene";

interface ProviderConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  deployment?: string;
  apiVersion?: string;
}

interface ProvidersState {
  active: string;
  providers: Record<string, ProviderConfig>;
}

const STORAGE_KEY = "devcanvas.providers.v1";

const loadProviders = (): ProvidersState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProvidersState) : null;
  } catch {
    return null;
  }
};

const SYSTEM_PROMPT = `You are a senior product designer. Given a short product brief, design a multi-screen wireframe and the page-flow connecting them.

Return STRICT JSON matching this TypeScript shape, and nothing else (no prose, no code fences):

{
  "pages": [
    { "id": "string", "name": "string", "description": "string" }
  ],
  "nodes": [
    {
      "pageId": "string",         // must match a page id above
      "type": "box" | "text" | "image" | "button" | "input",
      "x": number,                // 0..380, relative to page
      "y": number,                // 0..680, relative to page
      "width": number,
      "height": number,
      "content": "string"          // text/button label, input placeholder, optional for box/image
    }
  ],
  "edges": [
    { "from": "pageId", "to": "pageId", "label": "string" }
  ]
}

Rules:
- Page canvas is 420 wide x 720 tall. Keep nodes inside with 20px padding.
- Generate 3-6 pages that cover the user's brief end-to-end (e.g. landing, sign-in, dashboard, settings).
- Per page, generate 6-14 elements forming a realistic wireframe (header, content, primary action).
- Use \`text\` for labels/headings, \`input\` for fields, \`button\` for CTAs, \`image\` for media placeholders, \`box\` as containers/cards.
- Edges express user navigation (e.g. landing -> sign in, sign in -> dashboard). 2-6 edges total.
- Use short, lowercase, kebab-case page ids like "landing", "sign-in", "dashboard".`;

const buildUrl = (cfg: ProviderConfig, providerId: string) => {
  if (providerId === "azure") {
    // https://RESOURCE.openai.azure.com/openai/deployments/DEPLOYMENT/chat/completions?api-version=...
    const base = cfg.baseUrl.replace(/\/$/, "");
    return `${base}/openai/deployments/${cfg.deployment}/chat/completions?api-version=${cfg.apiVersion ?? "2024-08-01-preview"}`;
  }
  if (providerId === "anthropic") {
    return `${cfg.baseUrl.replace(/\/$/, "")}/messages`;
  }
  if (providerId === "google") {
    return `${cfg.baseUrl.replace(/\/$/, "")}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
  }
  return `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
};

const buildHeaders = (cfg: ProviderConfig, providerId: string): HeadersInit => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (providerId === "azure") {
    h["api-key"] = cfg.apiKey;
  } else if (providerId === "anthropic") {
    h["x-api-key"] = cfg.apiKey;
    h["anthropic-version"] = "2023-06-01";
    h["anthropic-dangerous-direct-browser-access"] = "true";
  } else if (providerId === "google") {
    // key in URL
  } else if (cfg.apiKey) {
    h["Authorization"] = `Bearer ${cfg.apiKey}`;
  }
  return h;
};

const buildBody = (cfg: ProviderConfig, providerId: string, prompt: string) => {
  if (providerId === "anthropic") {
    return {
      model: cfg.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    };
  }
  if (providerId === "google") {
    return {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    };
  }
  // openai-compatible (openai, azure, mistral, groq, deepseek, openrouter, xai, ollama, custom)
  return {
    model: providerId === "azure" ? undefined : cfg.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  };
};

const extractText = (providerId: string, json: any): string => {
  if (providerId === "anthropic") {
    return json?.content?.[0]?.text ?? "";
  }
  if (providerId === "google") {
    return json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  }
  return json?.choices?.[0]?.message?.content ?? "";
};

const tryParseJson = (text: string): any => {
  // strip code fences if any
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // try to find first { ... last }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model response was not valid JSON");
  }
};

export interface GeneratedScene {
  pages: Page[];
  nodes: CanvasNode[];
  edges: Edge[];
}

const PAGE_GAP = 80;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

const normalize = (raw: any): GeneratedScene => {
  if (!raw || !Array.isArray(raw.pages)) throw new Error("AI response missing pages");

  const pageIdMap = new Map<string, string>(); // model id -> internal id
  const pages: Page[] = raw.pages.map((p: any, i: number) => {
    const id = uid("p");
    pageIdMap.set(String(p.id ?? p.name ?? i), id);
    return {
      id,
      name: String(p.name ?? `Page ${i + 1}`),
      position: { x: 120 + i * (420 + PAGE_GAP), y: 120 },
      size: { width: 420, height: 720 },
      background: "#0f0d0b",
    };
  });

  const nodes: CanvasNode[] = [];
  (raw.nodes ?? []).forEach((n: any, idx: number) => {
    const pageId = pageIdMap.get(String(n.pageId));
    if (!pageId) return;
    const type: NodeType = (["box", "text", "image", "button", "input"] as NodeType[]).includes(n.type)
      ? n.type
      : "box";
    const ds = defaultSizeFor(type);
    nodes.push({
      id: uid("n"),
      pageId,
      type,
      position: {
        x: Math.max(0, Math.min(400, Number(n.x ?? 20))),
        y: Math.max(0, Math.min(700, Number(n.y ?? 20))),
      },
      size: {
        width: Math.max(20, Number(n.width ?? ds.width)),
        height: Math.max(20, Number(n.height ?? ds.height)),
      },
      style: defaultStyleFor(type),
      content: n.content !== undefined ? String(n.content) : undefined,
      zIndex: idx + 1,
    });
  });

  const edges: Edge[] = [];
  (raw.edges ?? []).forEach((e: any) => {
    const from = pageIdMap.get(String(e.from));
    const to = pageIdMap.get(String(e.to));
    if (!from || !to || from === to) return;
    edges.push({
      id: uid("e"),
      fromPageId: from,
      toPageId: to,
      label: e.label ? String(e.label) : undefined,
    });
  });

  return { pages, nodes, edges };
};

async function callProvider(prompt: string, system: string): Promise<string> {
  const state = loadProviders();
  if (!state) throw new Error("No provider configured. Open Settings to add an API key.");
  const providerId = state.active;
  const cfg = state.providers[providerId];
  if (!cfg) throw new Error("Active provider not found.");
  if (providerId !== "ollama" && !cfg.apiKey) {
    throw new Error(`Add an API key for ${providerId} in Settings.`);
  }
  if (providerId === "azure" && !cfg.deployment) {
    throw new Error("Azure OpenAI requires a deployment name.");
  }

  const url = buildUrl(cfg, providerId);
  const headers = buildHeaders(cfg, providerId);
  // buildBody uses module-scoped SYSTEM_PROMPT, so swap temporarily by passing
  // the system through the messages directly when not using the wireframe shape.
  let body: any;
  if (providerId === "anthropic") {
    body = {
      model: cfg.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
    };
  } else if (providerId === "google") {
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    };
  } else {
    body = {
      model: providerId === "azure" ? undefined : cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    };
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`${providerId} ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const text = extractText(providerId, json);
  if (!text) throw new Error("Empty response from model");
  return text;
}

export const generateWireframe = async (brief: string): Promise<GeneratedScene> => {
  rememberPrompt(brief);
  const text = await callProvider(brief, SYSTEM_PROMPT);
  return normalize(tryParseJson(text));
};

// ---------- Single-page regeneration ----------

const PAGE_REGEN_SYSTEM = `You redesign a single page in an existing multi-page wireframe.
Return STRICT JSON: { "nodes": [ { "type", "x", "y", "width", "height", "content" } ] }
- Page canvas is 420x720, keep nodes inside with 20px padding.
- 6-14 nodes. Use box/text/image/button/input only.
- No prose, no code fences.`;

export interface RegeneratedNodes {
  nodes: CanvasNode[];
}

export const regeneratePage = async (
  pageName: string,
  brief: string,
  pageId: string,
): Promise<RegeneratedNodes> => {
  const userMsg = `Page name: "${pageName}"\nBrief: ${brief}`;
  const text = await callProvider(userMsg, PAGE_REGEN_SYSTEM);
  const raw = tryParseJson(text);
  if (!raw || !Array.isArray(raw.nodes)) throw new Error("AI response missing nodes");
  const nodes: CanvasNode[] = raw.nodes.map((n: any, idx: number) => {
    const type: NodeType = (["box", "text", "image", "button", "input"] as NodeType[]).includes(n.type)
      ? n.type
      : "box";
    const ds = defaultSizeFor(type);
    return {
      id: uid("n"),
      pageId,
      type,
      position: {
        x: Math.max(0, Math.min(400, Number(n.x ?? 20))),
        y: Math.max(0, Math.min(700, Number(n.y ?? 20))),
      },
      size: {
        width: Math.max(20, Number(n.width ?? ds.width)),
        height: Math.max(20, Number(n.height ?? ds.height)),
      },
      style: defaultStyleFor(type),
      content: n.content !== undefined ? String(n.content) : undefined,
      zIndex: idx + 1,
    };
  });
  return { nodes };
};

// ---------- Inline edit on a single node ----------

const INLINE_EDIT_SYSTEM = `You receive a single UI element from a wireframe and an instruction.
Return STRICT JSON describing the new state of that element only:
{ "type": "box|text|image|button|input", "x": number, "y": number,
  "width": number, "height": number, "content": "string", "background": "#hex",
  "color": "#hex", "fontSize": number }
Only include fields you actually changed. No prose, no code fences.`;

export interface InlineEdit {
  type?: NodeType;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  content?: string;
  style?: Partial<CanvasNode["style"]>;
}

export const inlineEditNode = async (
  node: CanvasNode,
  instruction: string,
): Promise<InlineEdit> => {
  const userMsg = `Element:\n${JSON.stringify(
    {
      type: node.type,
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
      width: node.size.width,
      height: node.size.height,
      content: node.content,
      background: node.style.background,
      color: node.style.color,
      fontSize: node.style.fontSize,
    },
    null,
    2,
  )}\nInstruction: ${instruction}`;
  const text = await callProvider(userMsg, INLINE_EDIT_SYSTEM);
  const raw = tryParseJson(text);
  const patch: InlineEdit = {};
  if (raw.type && (["box", "text", "image", "button", "input"] as NodeType[]).includes(raw.type)) {
    patch.type = raw.type;
  }
  if (typeof raw.x === "number" || typeof raw.y === "number") {
    patch.position = {
      x: typeof raw.x === "number" ? raw.x : node.position.x,
      y: typeof raw.y === "number" ? raw.y : node.position.y,
    };
  }
  if (typeof raw.width === "number" || typeof raw.height === "number") {
    patch.size = {
      width: typeof raw.width === "number" ? raw.width : node.size.width,
      height: typeof raw.height === "number" ? raw.height : node.size.height,
    };
  }
  if (typeof raw.content === "string") patch.content = raw.content;
  const style: Partial<CanvasNode["style"]> = {};
  if (typeof raw.background === "string") style.background = raw.background;
  if (typeof raw.color === "string") style.color = raw.color;
  if (typeof raw.fontSize === "number") style.fontSize = raw.fontSize;
  if (Object.keys(style).length) patch.style = style;
  return patch;
};

// ---------- Prompt history ----------

const HISTORY_KEY = "devcanvas:promptHistory";

export const loadPromptHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

export const rememberPrompt = (p: string) => {
  const trimmed = p.trim();
  if (!trimmed) return;
  const cur = loadPromptHistory();
  const next = [trimmed, ...cur.filter((x) => x !== trimmed)].slice(0, 12);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
};

export const clearPromptHistory = () => localStorage.removeItem(HISTORY_KEY);
