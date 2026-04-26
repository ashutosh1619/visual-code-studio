import type { Page, CanvasNode, Edge, NodeType, Fidelity } from "./scene";
import { defaultStyleFor, defaultSizeFor } from "./scene";
import {
  layoutPage,
  fallbackPageIA,
  type IADocument,
  type IANode,
  type IAPage,
} from "./layout";

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

// =================================================================
// Two-pass generation
//   Pass 1 — INFORMATION ARCHITECTURE: AI emits semantic IA tree.
//   Pass 2 — LAYOUT: deterministic engine in /lib/layout.ts.
// This eliminates absolute-position overlaps and "AI-y" misalignment.
// =================================================================

const IA_SYSTEM_PROMPT_BASE = `You are a senior product designer producing a multi-screen wireframe sheet (like a Figma frame storyboard). Given a brief, design every key screen using ABSTRACT INFORMATION ARCHITECTURE — a tree of layout primitives. A separate layout engine computes pixel positions, so you MUST NOT emit any coordinates.

Return STRICT JSON, no prose, no code fences:

{
  "pages": [
    { "id": "kebab-case-id", "name": "Display Name", "root": <Container> }
  ],
  "edges": [ { "from": "page-id", "to": "page-id", "label": "user action" } ]
}

A <Container> is one of:
  { "kind": "stack", "direction": "column"|"row", "gap": 1..4, "padding": 0..3, "children": [<Node>, ...] }
  { "kind": "grid",  "columns": 2|3|4, "gap": 1..3, "padding": 0..2, "children": [<Node>, ...] }

A <Leaf> is:
  { "kind": "leaf", "type": <PrimitiveType>, "content": "...",
    "textStyle": "display|h1|h2|h3|body|caption|label",  // ONLY for text
    "height": 60, "widthFrac": 1,                         // optional
    "data": { "title": "...", "meta": "...", "trailing": "...",
              "options": ["..."], "active": 0, "glyph": "♥", "badge": "40% OFF" }
  }

PrimitiveType vocabulary — USE THESE LIBERALLY, not just text/box:
  • text                 — headings, paragraphs, labels (always set textStyle)
  • button               — primary CTA
  • input                — search field / form input (use 'content' for placeholder)
  • image-placeholder    — image area (renders mountain/sun glyph)
  • icon-circle          — round icon button (set data.glyph for letter/symbol)
  • chip                 — pill filter/tag (e.g. "4.0+", "Pure Veg", "Offers")
  • list-row             — full-width row: thumb + title + meta + trailing.
                           Set data.title/data.meta/data.trailing.
  • card                 — product/menu/restaurant card. Set data.title/meta/trailing.
                           Use data.badge for promo overlay (e.g. "40% OFF").
  • map-block            — map area for tracking/location pages
  • segmented            — tab strip. Set data.options + data.active
  • bottom-bar           — sticky action footer (Place Order, View Cart, etc.)
  • sidebar              — vertical nav strip (use for profile pages)
  • stepper              — checkout/order progress. Set data.options + data.active
  • divider              — 1px hairline separator
  • box                  — generic surface (use sparingly)

SECTION TEMPLATES — when the brief implies a domain, compose these:
  • Search hero    → stack[ text(h1), input, row[chip x4] ]
  • Category strip → grid(columns=4)[ stack[icon-circle,text(label)] x8 ]
  • Card grid      → grid(columns=2)[ card x6 ] with data.title/meta/trailing
  • List feed      → stack[ list-row x5 ]
  • Filter rail    → stack[ text(h3 'Filters'), text(label), chip rows ]
  • Cart summary   → stack[ list-row, divider, row[text label, text value], button ]
  • Order tracking → stack[ map-block, stepper, list-row x3 ]
  • Bottom nav     → bottom-bar with data.options
  • Profile nav    → sidebar with data.options + data.active

Hard rules:
- Page area is 420x720. Root container is a vertical "stack".
- Generate 4-8 pages covering the WHOLE flow (e.g. landing, search, detail, cart, checkout, tracking, profile, success).
- Per page: 10-25 leaves. Use REAL product copy ("Behrouz Biryani", "₹250", "30 mins"), not lorem.
- ALWAYS set "textStyle" on text leaves. Use h1 once per page max.
- Use "row" stacks with widthFrac for two-column layouts (e.g. cart row: title 0.7, price 0.3).
- Use "grid" for cards/categories (NOT for whole pages).
- Group related items in nested stacks — DO NOT flatten.
- Edges express navigation. 4-10 edges total.
- NEVER emit x, y, width, height as coordinates. Only height as a HINT for image/map.`;

const FIDELITY_NOTE: Record<Fidelity, string> = {
  wireframe:
    "\n\nFIDELITY: WIREFRAME. The output is a low-fidelity sketch — neutral surfaces, single accent color reserved for primary CTAs and badges. Use image-placeholder, not real images.",
  hifi:
    "\n\nFIDELITY: HI-FI. Use the full token palette. Cards may carry imagery (still as image-placeholder leaves) and richer hierarchy.",
};

const buildUrl = (cfg: ProviderConfig, providerId: string) => {
  if (providerId === "azure") {
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
  if (providerId === "azure") h["api-key"] = cfg.apiKey;
  else if (providerId === "anthropic") {
    h["x-api-key"] = cfg.apiKey;
    h["anthropic-version"] = "2023-06-01";
    h["anthropic-dangerous-direct-browser-access"] = "true";
  } else if (providerId === "google") {
    /* key in URL */
  } else if (cfg.apiKey) {
    h["Authorization"] = `Bearer ${cfg.apiKey}`;
  }
  return h;
};

const extractText = (providerId: string, json: any): string => {
  if (providerId === "anthropic") return json?.content?.[0]?.text ?? "";
  if (providerId === "google")
    return json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  return json?.choices?.[0]?.message?.content ?? "";
};

const tryParseJson = (text: string): any => {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
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

async function callProvider(prompt: string, system: string): Promise<string> {
  const state = loadProviders();
  if (!state) throw new Error("No provider configured. Open Settings to add an API key.");
  const providerId = state.active;
  const cfg = state.providers[providerId];
  if (!cfg) throw new Error("Active provider not found.");
  if (providerId !== "ollama" && !cfg.apiKey)
    throw new Error(`Add an API key for ${providerId} in Settings.`);
  if (providerId === "azure" && !cfg.deployment)
    throw new Error("Azure OpenAI requires a deployment name.");

  const url = buildUrl(cfg, providerId);
  const headers = buildHeaders(cfg, providerId);
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

const sanitizeIA = (n: any): IANode => {
  if (!n || typeof n !== "object") return { kind: "leaf", type: "box" };
  if (n.kind === "stack" || n.kind === "grid") {
    return {
      kind: n.kind,
      direction: n.direction === "row" ? "row" : "column",
      gap: typeof n.gap === "number" ? Math.max(0, Math.min(4, n.gap)) : 2,
      padding: typeof n.padding === "number" ? Math.max(0, Math.min(3, n.padding)) : 0,
      columns: typeof n.columns === "number" ? Math.max(1, Math.min(4, n.columns)) : undefined,
      children: Array.isArray(n.children) ? n.children.map(sanitizeIA) : [],
    };
  }
  // leaf
  const validTypes: NodeType[] = ["box", "text", "image", "button", "input"];
  const type: NodeType = validTypes.includes(n.type) ? n.type : "box";
  return {
    kind: "leaf",
    type,
    content: n.content !== undefined ? String(n.content) : undefined,
    textStyle: n.textStyle,
    height: typeof n.height === "number" ? n.height : undefined,
    widthFrac: typeof n.widthFrac === "number" ? n.widthFrac : undefined,
  };
};

const normalizeIA = (raw: any): GeneratedScene => {
  if (!raw || !Array.isArray(raw.pages)) throw new Error("AI response missing pages");
  const idMap = new Map<string, string>();
  const pages: Page[] = [];
  const nodes: CanvasNode[] = [];

  raw.pages.forEach((p: any, i: number) => {
    const internalId = uid("p");
    idMap.set(String(p.id ?? p.name ?? i), internalId);
    const page: Page = {
      id: internalId,
      name: String(p.name ?? `Page ${i + 1}`),
      position: { x: 120 + i * (420 + PAGE_GAP), y: 120 },
      size: { width: 420, height: 720 },
      background: "#0f0d0b",
    };
    pages.push(page);
    const root = sanitizeIA(p.root ?? fallbackPageIA(page.name));
    const laid = layoutPage({ id: internalId, name: page.name, root } as IAPage, internalId);
    nodes.push(...laid.nodes);
  });

  const edges: Edge[] = [];
  (raw.edges ?? []).forEach((e: any) => {
    const from = idMap.get(String(e.from));
    const to = idMap.get(String(e.to));
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

export const generateWireframe = async (brief: string): Promise<GeneratedScene> => {
  rememberPrompt(brief);
  const text = await callProvider(brief, IA_SYSTEM_PROMPT);
  return normalizeIA(tryParseJson(text));
};

// ---------- Single-page regeneration (also IA-based) ----------

const PAGE_REGEN_SYSTEM = `You redesign ONE page of a wireframe using the same IA primitives.
Return STRICT JSON: { "root": <Container> } — no coordinates.
Containers: stack (column|row, gap, padding) or grid (columns, gap).
Leaves: { kind:"leaf", type, content, textStyle, height?, widthFrac? }.
Page area 420x720. 8-18 leaves, real product copy, semantic textStyles.
No prose, no code fences.`;

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
  const root = sanitizeIA(raw.root ?? fallbackPageIA(pageName));
  const laid = layoutPage({ id: pageId, name: pageName, root } as IAPage, pageId);
  return { nodes: laid.nodes };
};

// ---------- Inline edit on a single node ----------

const INLINE_EDIT_SYSTEM = `You receive a single UI element from a wireframe and an instruction.
Return STRICT JSON describing the new state of that element only:
{ "type": "box|text|image|button|input", "content": "string",
  "background": "#hex", "color": "#hex", "fontSize": number,
  "textStyle": "display|h1|h2|h3|body|caption|label" }
Only include fields you actually changed. No prose, no code fences.`;

export interface InlineEdit {
  type?: NodeType;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  content?: string;
  style?: Partial<CanvasNode["style"]>;
  textStyle?: CanvasNode["textStyle"];
}

export const inlineEditNode = async (
  node: CanvasNode,
  instruction: string,
): Promise<InlineEdit> => {
  const userMsg = `Element:\n${JSON.stringify(
    {
      type: node.type,
      content: node.content,
      background: node.style.background,
      color: node.style.color,
      fontSize: node.style.fontSize,
      textStyle: node.textStyle,
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
  if (typeof raw.content === "string") patch.content = raw.content;
  const style: Partial<CanvasNode["style"]> = {};
  if (typeof raw.background === "string") style.background = raw.background;
  if (typeof raw.color === "string") style.color = raw.color;
  if (typeof raw.fontSize === "number") style.fontSize = raw.fontSize;
  if (Object.keys(style).length) patch.style = style;
  if (
    typeof raw.textStyle === "string" &&
    ["display", "h1", "h2", "h3", "body", "caption", "label"].includes(raw.textStyle)
  ) {
    patch.textStyle = raw.textStyle;
  }
  return patch;
};

// ---------- Vision-grounded auto-fix pass ----------
//
// We render each page to a JSON description (faster + cheaper than screenshots,
// and works on any provider) and ask the model to flag issues + propose
// per-node patches. A real screenshot path would require canvas->image; we
// surface the JSON-grounded version here as a working MVP.

const AUTOFIX_SYSTEM = `You are a UI quality reviewer. You receive a JSON description of a single wireframe page (page size 420x720 with elements at absolute coords). Find:
- Overlapping elements (rects intersect)
- Out-of-bounds elements
- Text that is too long for its width
- Poor contrast (text color vs background)
- Misalignment from the 8px grid

Return STRICT JSON:
{ "fixes": [
  { "id": "node-id", "patch": {
      "x": number?, "y": number?, "width": number?, "height": number?,
      "content": "string?", "color": "#hex?", "background": "#hex?", "fontSize": number?
    }, "reason": "short" }
] }
Only return fixes you are confident about. Empty array is fine. No prose, no code fences.`;

export interface AutoFix {
  id: string;
  reason: string;
  patch: {
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    content?: string;
    style?: Partial<CanvasNode["style"]>;
  };
}

export const autoFixPage = async (
  page: Page,
  pageNodes: CanvasNode[],
): Promise<AutoFix[]> => {
  const desc = {
    page: { name: page.name, width: page.size.width, height: page.size.height, background: page.background },
    nodes: pageNodes.map((n) => ({
      id: n.id,
      type: n.type,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      width: Math.round(n.size.width),
      height: Math.round(n.size.height),
      content: n.content,
      background: n.style.background,
      color: n.style.color,
      fontSize: n.style.fontSize,
    })),
  };
  const text = await callProvider(JSON.stringify(desc), AUTOFIX_SYSTEM);
  const raw = tryParseJson(text);
  const fixes: AutoFix[] = [];
  for (const f of raw.fixes ?? []) {
    if (!f.id || !f.patch) continue;
    const patch: AutoFix["patch"] = {};
    const style: Partial<CanvasNode["style"]> = {};
    if (typeof f.patch.x === "number" || typeof f.patch.y === "number") {
      const orig = pageNodes.find((n) => n.id === f.id);
      if (orig) {
        patch.position = {
          x: typeof f.patch.x === "number" ? f.patch.x : orig.position.x,
          y: typeof f.patch.y === "number" ? f.patch.y : orig.position.y,
        };
      }
    }
    if (typeof f.patch.width === "number" || typeof f.patch.height === "number") {
      const orig = pageNodes.find((n) => n.id === f.id);
      if (orig) {
        patch.size = {
          width: typeof f.patch.width === "number" ? f.patch.width : orig.size.width,
          height: typeof f.patch.height === "number" ? f.patch.height : orig.size.height,
        };
      }
    }
    if (typeof f.patch.content === "string") patch.content = f.patch.content;
    if (typeof f.patch.background === "string") style.background = f.patch.background;
    if (typeof f.patch.color === "string") style.color = f.patch.color;
    if (typeof f.patch.fontSize === "number") style.fontSize = f.patch.fontSize;
    if (Object.keys(style).length) patch.style = style;
    fixes.push({ id: f.id, reason: String(f.reason ?? ""), patch });
  }
  return fixes;
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
