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

const IA_SYSTEM_PROMPT_BASE = `You are a SENIOR PRODUCT DESIGNER (10+ yrs, ex-Stripe / Linear / Airbnb caliber) acting as the user's UX partner. You translate ANY product brief — SaaS, fintech, healthtech, e-commerce, social, gaming, dev tools, marketplaces, internal dashboards, mobile apps, marketing sites, etc. — into a complete multi-screen wireframe sheet (Figma-storyboard style).

Your job has FOUR layers of thinking — perform them silently before emitting JSON:

1. DOMAIN MODELING
   • Identify the domain, primary persona(s), and their top 3 jobs-to-be-done.
   • Infer the core entities (e.g. "Invoice", "Patient", "Track", "Workspace") and their key attributes. Use plausible REAL field names and example values from the inferred domain — never lorem ipsum, never reuse examples from other domains.
   • Pick a tone register (enterprise / consumer / playful / clinical / editorial) and stay consistent across screens.

2. INFORMATION ARCHITECTURE
   • Map the end-to-end flow: entry → discovery → action → confirmation → retention. Cover empty states, success states, and at least one settings/profile surface where relevant.
   • Decide which screens are essential. Prefer 5-8 screens that tell a coherent story over 12 disconnected ones.
   • For each screen, define its single primary goal in one sentence (mentally), then design the layout to make that goal obvious within 2 seconds.

3. COMPONENT & DATA STRUCTURE
   • Choose the right primitive for each piece of content (see vocabulary). A list of items is NEVER plain text — it's list-row or card. A nav is NEVER text — it's segmented / bottom-bar / sidebar. Filters are chips. Progress is stepper.
   • Populate data.title / data.meta / data.trailing / data.badge / data.glyph / data.options / data.active with realistic values for the chosen domain.
   • Respect platform conventions: mobile apps get bottom-bar, desktop apps get sidebar, marketing sites get hero + sections + footer.

4. VISUAL HIERARCHY & RHYTHM
   • One h1 per page. Use h2 / h3 to chunk sections. body for descriptions, caption for metadata, label for form labels.
   • Group related elements in nested stacks with consistent gap/padding. NEVER flatten everything to the root.
   • Two-column rows use "row" stacks with widthFrac (e.g. label 0.6 / value 0.4). Card grids use "grid" with columns 2 or 3.

────────────────────────────────────────────────────────
OUTPUT FORMAT — STRICT JSON, no prose, no code fences:

{
  "pages": [
    { "id": "kebab-case-id", "name": "Display Name", "root": <Container> }
  ],
  "edges": [ { "from": "page-id", "to": "page-id", "label": "user action" } ]
}

<Container>:
  { "kind": "stack", "direction": "column"|"row", "gap": 1..4, "padding": 0..3, "children": [<Node>, ...] }
  { "kind": "grid",  "columns": 2|3|4, "gap": 1..3, "padding": 0..2, "children": [<Node>, ...] }

<Leaf>:
  { "kind": "leaf", "type": <PrimitiveType>, "content": "...",
    "textStyle": "display|h1|h2|h3|body|caption|label",
    "height": 60, "widthFrac": 1,
    "data": { "title": "...", "meta": "...", "trailing": "...",
              "options": ["..."], "active": 0, "glyph": "♥", "badge": "NEW" }
  }

PrimitiveType vocabulary — pick the SEMANTICALLY RIGHT one. NEVER use "text" for a label/value pair, NEVER use "box" for content (use card/list-row/kpi-card instead). NEVER leave a box empty.

  • text                 — headings, paragraphs (always set textStyle). Use SPARINGLY — 3-6 per page max.
  • button               — primary CTA (filled). Use 1-2 per page.
  • input                — search/form field; set 'content' to a realistic placeholder ("Search restaurants near you")
  • image-placeholder    — image area (hero, avatar, thumbnail). Set data.glyph for emoji/icon hint
  • icon-circle          — round icon tile (set data.glyph: 🍕 ★ 🛒 📊 ⚙ 💳 …) — use in category strips
  • chip                 — pill: filter/tag/status. ALWAYS set data.title and optional data.glyph
  • list-row             — full row: data.title, data.meta, data.trailing, optional data.glyph
  • card                 — grid tile: data.title, data.meta, data.trailing (price), data.badge ("NEW", "-20%"), data.rating, data.reviews
  • map-block            — map area
  • segmented            — tab strip: data.options + data.active
  • bottom-bar           — sticky mobile footer: data.options + data.active OR a CTA with data.title + data.meta
  • sidebar              — vertical nav: data.options + data.active
  • stepper              — step progress: data.options + data.active
  • divider              — 1px separator between sections
  • kpi-card             — DASHBOARD METRIC TILE: data.title (label), data.trailing ("$48.2k"), data.delta ("+12.4%"), data.trend ("up"|"down"|"flat"), data.glyph (📈 💰 👥)
  • slider               — range slider: data.title, data.value (0-100), data.min ("$0"), data.max ("$500"), data.trailing ("$120")
  • progress             — progress bar: data.title, data.value (0-100), data.trailing ("3 of 5")
  • rating               — ★★★★☆ + numeric: data.rating (0-5, e.g. 4.7), data.reviews (e.g. 1284)
  • avatar-stack         — overlapping circles: data.count (total), data.meta ("members"|"viewing")
  • tag                  — small status pill: data.title ("Active", "Failed"), data.tone ("success"|"warning"|"danger"|"info"|"neutral")
  • checkbox-row         — checkbox + label: data.title, data.meta, data.checked (bool), data.trailing
  • toggle-row           — settings switch: data.title, data.meta, data.on (bool)
  • chart-bar            — bar chart: data.title, data.trailing (delta), data.series (array of 6-12 numbers 0-100)
  • chart-line           — line chart: data.title, data.trailing ("+12.4%"), data.series (array of 8-16 numbers)
  • box                  — generic surface — AVOID. Use a specific primitive instead.

SECTION TEMPLATES — compose these wherever they fit the domain:
  • Search hero      → stack[ text(h1), input, row[chip x4-6 with glyph] ]
  • Category strip   → grid(columns=4)[ stack[icon-circle with glyph, text(label)] x4-8 ]
  • Card grid        → grid(columns=2)[ card x4-6 with badge/rating/trailing price ]
  • List feed        → stack[ list-row x4-6 with glyph + meta + trailing ]
  • Filter rail      → stack[ text(h3), slider, divider, chip rows, divider, checkbox-row x3 ]
  • Summary panel    → stack[ list-row x2, divider, row[text label, text value], button ]
  • Multi-step form  → stack[ stepper, text(h2), input x3-5, button ]
  • Detail header    → stack[ image-placeholder(height:220), text(h1), rating, row[button, button] ]
  • KPI dashboard    → grid(columns=3)[ kpi-card x3 with delta + trend ] then chart-line below
  • Activity feed    → stack[ list-row x4-6 with avatars/glyphs ]
  • Settings page    → stack[ text(h2), toggle-row x4-5, divider, checkbox-row x3 ]
  • Profile header   → row[ image-placeholder(circle), stack[text(h2), text(caption), avatar-stack] ]
  • Empty state      → stack[ image-placeholder, text(h2), text(body), button ]

HARD RULES (non-negotiable):
- Page area is 420×720. Root container is a vertical "stack" with padding 2.
- Generate 5-8 pages covering the WHOLE journey for the inferred domain.
- Per page: 14-28 leaves. DENSE, realistic, domain-specific copy — names, numbers, dates, statuses, prices, percentages, real-world IDs.
- ALWAYS use kpi-card for dashboard metrics (NOT card with title="MRR")
- ALWAYS use chart-bar/chart-line for analytics screens — every dashboard MUST have at least one chart
- ALWAYS use rating + reviews on product/restaurant/listing cards
- ALWAYS use tag (with tone) for statuses like "Active", "Pending", "Paid", "Failed"
- ALWAYS use slider for price/distance/range filters
- ALWAYS use icon-circle with data.glyph for category strips (food: 🍕🍔🥗🍣, finance: 💳💰📊⚡, health: ❤️💊🩺📋)
- ALWAYS populate data.glyph on list-row when the row represents a category/feature/quick-action
- Every card in a product grid MUST have data.title + data.meta + data.trailing (price) and ideally data.badge or data.rating
- Realistic numbers: prices "$48.2k", "₹680", percentages "+12.4%", dates "Mar 12 · 2:30 PM", counts "1,284 users"
- Set "textStyle" on every text leaf. One h1 per page maximum.
- Use nested stacks for grouping. NEVER flatten everything to root level.
- Use "row" stacks with widthFrac for two-column rows.
- Use "grid" for repeated cards/icons (columns: 2, 3, or 4).
- Edges express realistic navigation between screens. 4-10 edges.
- NEVER emit x/y/width as coordinates.
- DO NOT borrow copy from unrelated domains (no food/restaurant copy unless the brief is about food).
- EVERY container MUST have "kind":"stack" or "kind":"grid". EVERY leaf MUST have "kind":"leaf".

────────────────────────────────────────────────────────
MINI EXAMPLE (shape only — your real output covers the whole journey):

{
  "pages": [
    {
      "id": "dashboard",
      "name": "Dashboard",
      "root": {
        "kind": "stack", "direction": "column", "gap": 2, "padding": 2,
        "children": [
          { "kind": "leaf", "type": "text", "textStyle": "h1", "content": "Good morning, Alex" },
          { "kind": "leaf", "type": "text", "textStyle": "caption", "content": "Tuesday, March 12 · 9 unread" },
          { "kind": "grid", "columns": 3, "gap": 2, "children": [
            { "kind": "leaf", "type": "kpi-card", "data": { "title": "MRR", "trailing": "$48.2k", "delta": "12.4%", "trend": "up", "glyph": "💰" } },
            { "kind": "leaf", "type": "kpi-card", "data": { "title": "Active", "trailing": "1,284", "delta": "3.4%", "trend": "up", "glyph": "👥" } },
            { "kind": "leaf", "type": "kpi-card", "data": { "title": "Churn", "trailing": "2.1%", "delta": "0.3%", "trend": "down", "glyph": "📉" } }
          ]},
          { "kind": "leaf", "type": "chart-line", "height": 140, "data": { "title": "Revenue · 30d", "trailing": "+18.2%", "series": [22,28,24,32,38,30,42,40,52,48,60,58,66,72] } },
          { "kind": "leaf", "type": "text", "textStyle": "h3", "content": "Recent activity" },
          { "kind": "stack", "direction": "column", "gap": 1, "children": [
            { "kind": "leaf", "type": "list-row", "data": { "title": "Invoice #1042 paid", "meta": "Acme Corp · 2h ago", "trailing": "$2,400", "glyph": "💳" } },
            { "kind": "leaf", "type": "list-row", "data": { "title": "New signup: Priya S.", "meta": "Pro plan · 4h ago", "trailing": "Trial", "glyph": "✨" } },
            { "kind": "leaf", "type": "list-row", "data": { "title": "Refund processed", "meta": "Order #8821 · 6h ago", "trailing": "-$89", "glyph": "↩" } }
          ]},
          { "kind": "row", "kind": "stack", "direction": "row", "gap": 2, "children": [
            { "kind": "leaf", "type": "tag", "widthFrac": 0.3, "data": { "title": "Live", "tone": "success" } },
            { "kind": "leaf", "type": "avatar-stack", "widthFrac": 0.7, "data": { "count": 8, "meta": "viewing now" } }
          ]}
        ]
      }
    }
  ],
  "edges": [{ "from": "dashboard", "to": "billing", "label": "view invoice" }]
}`;

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

const VALID_NODE_TYPES: NodeType[] = [
  "box", "text", "image", "button", "input",
  "image-placeholder", "icon-circle", "chip", "list-row", "card",
  "map-block", "segmented", "bottom-bar", "sidebar", "stepper", "divider",
  "slider", "avatar-stack", "rating", "progress", "kpi-card", "tag",
  "checkbox-row", "toggle-row", "chart-bar", "chart-line",
];

const VALID_TONES = ["success", "warning", "danger", "info", "neutral"] as const;
const VALID_TRENDS = ["up", "down", "flat"] as const;

const sanitizeData = (raw: any) => {
  if (!raw || typeof raw !== "object") return undefined;
  const data: Record<string, unknown> = {};
  if (typeof raw.title === "string") data.title = raw.title;
  if (typeof raw.meta === "string") data.meta = raw.meta;
  if (typeof raw.trailing === "string" || typeof raw.trailing === "number")
    data.trailing = String(raw.trailing);
  if (typeof raw.glyph === "string") data.glyph = raw.glyph.slice(0, 3);
  if (typeof raw.badge === "string") data.badge = raw.badge.slice(0, 16);
  if (Array.isArray(raw.options))
    data.options = raw.options
      .filter((o: unknown) => typeof o === "string")
      .slice(0, 8) as string[];
  if (typeof raw.active === "number") data.active = Math.max(0, Math.min(7, raw.active));
  if (typeof raw.value === "number") data.value = Math.max(0, Math.min(100, raw.value));
  if (typeof raw.min === "string" || typeof raw.min === "number") data.min = String(raw.min);
  if (typeof raw.max === "string" || typeof raw.max === "number") data.max = String(raw.max);
  if (typeof raw.rating === "number") data.rating = Math.max(0, Math.min(5, raw.rating));
  if (typeof raw.reviews === "number") data.reviews = Math.max(0, raw.reviews);
  if (typeof raw.delta === "string") data.delta = raw.delta.slice(0, 12);
  if (typeof raw.trend === "string" && (VALID_TRENDS as readonly string[]).includes(raw.trend))
    data.trend = raw.trend;
  if (typeof raw.count === "number") data.count = Math.max(0, Math.round(raw.count));
  if (Array.isArray(raw.series))
    data.series = raw.series
      .filter((v: unknown) => typeof v === "number")
      .slice(0, 32) as number[];
  if (typeof raw.on === "boolean") data.on = raw.on;
  if (typeof raw.checked === "boolean") data.checked = raw.checked;
  if (typeof raw.tone === "string" && (VALID_TONES as readonly string[]).includes(raw.tone))
    data.tone = raw.tone;
  return Object.keys(data).length ? data : undefined;
};

// Tolerant sanitizer — many models return slight schema variations
// (missing "kind", using "type":"stack", wrapping children in {sections:[...]},
// etc). We coerce any reasonable shape into the IA node format instead of
// silently collapsing to an empty box.
const inferKind = (n: any): "stack" | "grid" | "leaf" | null => {
  if (!n || typeof n !== "object") return null;
  if (n.kind === "stack" || n.kind === "grid" || n.kind === "leaf") return n.kind;
  // Common alternate shapes:
  if (n.type === "stack" || n.type === "container" || n.type === "section") return "stack";
  if (n.type === "grid") return "grid";
  // Has children → must be a container even if kind is missing.
  if (Array.isArray(n.children) && n.children.length > 0) {
    return n.columns && n.columns > 1 ? "grid" : "stack";
  }
  // Has a recognised leaf type → leaf.
  if (typeof n.type === "string" && VALID_NODE_TYPES.includes(n.type as NodeType)) return "leaf";
  return null;
};

const sanitizeIA = (n: any): IANode => {
  const kind = inferKind(n);
  if (!kind) return { kind: "leaf", type: "box" };

  if (kind === "stack" || kind === "grid") {
    // Children may live under .children, .items, .sections, or .nodes.
    const rawKids =
      (Array.isArray(n.children) && n.children) ||
      (Array.isArray(n.items) && n.items) ||
      (Array.isArray(n.sections) && n.sections) ||
      (Array.isArray(n.nodes) && n.nodes) ||
      [];
    return {
      kind,
      direction: n.direction === "row" ? "row" : "column",
      gap: typeof n.gap === "number" ? Math.max(0, Math.min(4, n.gap)) : 2,
      padding: typeof n.padding === "number" ? Math.max(0, Math.min(3, n.padding)) : 0,
      columns:
        typeof n.columns === "number"
          ? Math.max(1, Math.min(4, n.columns))
          : kind === "grid"
          ? 2
          : undefined,
      children: rawKids.map(sanitizeIA),
    };
  }

  // leaf
  const type: NodeType = VALID_NODE_TYPES.includes(n.type) ? n.type : "box";
  // Some models put copy under .text or .label.
  const content =
    n.content !== undefined
      ? String(n.content)
      : typeof n.text === "string"
      ? n.text
      : typeof n.label === "string"
      ? n.label
      : undefined;
  return {
    kind: "leaf",
    type,
    content,
    textStyle: n.textStyle,
    height: typeof n.height === "number" ? n.height : undefined,
    widthFrac: typeof n.widthFrac === "number" ? n.widthFrac : undefined,
    data: sanitizeData(n.data),
  };
};

const isEmptyRoot = (root: IANode): boolean => {
  if (root.kind === "leaf") return true;
  const kids = root.children ?? [];
  if (kids.length === 0) return true;
  // All children empty leaves with no content → effectively empty.
  return kids.every(
    (c) =>
      c.kind === "leaf" &&
      (c.type === "box" || !c.type) &&
      !c.content,
  );
};

const normalizeIA = (raw: any, fidelity: Fidelity): GeneratedScene => {
  if (!raw || !Array.isArray(raw.pages)) throw new Error("AI response missing pages");
  const idMap = new Map<string, string>();
  const pages: Page[] = [];
  const nodes: CanvasNode[] = [];
  const pageBg = fidelity === "wireframe" ? "#ffffff" : "#0f0d0b";

  raw.pages.forEach((p: any, i: number) => {
    const internalId = uid("p");
    idMap.set(String(p.id ?? p.name ?? i), internalId);
    const page: Page = {
      id: internalId,
      name: String(p.name ?? `Page ${i + 1}`),
      number: i + 1,
      position: { x: 120 + i * (420 + PAGE_GAP), y: 120 },
      size: { width: 420, height: 720 },
      background: pageBg,
      kind: "screen",
    };
    pages.push(page);
    let root = sanitizeIA(p.root ?? p.layout ?? p.content ?? p);
    if (isEmptyRoot(root)) {
      console.warn(
        `[devcanvas] page "${page.name}" returned empty root — using fallback. Raw payload:`,
        p,
      );
      root = sanitizeIA(fallbackPageIA(page.name));
    }
    const laid = layoutPage({ id: internalId, name: page.name, root } as IAPage, internalId, fidelity);
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

export const generateWireframe = async (
  brief: string,
  fidelity: Fidelity = "wireframe",
): Promise<GeneratedScene> => {
  rememberPrompt(brief);
  const system = IA_SYSTEM_PROMPT_BASE + FIDELITY_NOTE[fidelity];
  const text = await callProvider(brief, system);
  return normalizeIA(tryParseJson(text), fidelity);
};

// ---------- Single-page regeneration (also IA-based) ----------

const PAGE_REGEN_SYSTEM = `You are a senior product designer redesigning ONE page of a wireframe sheet. First infer the page's domain and primary user goal from the page name + brief, then design the layout to make that goal obvious in 2 seconds.

Return STRICT JSON: { "root": <Container> } — no coordinates.
Containers: stack (column|row, gap, padding, widthFrac on children) or grid (columns 2-4, gap).
Leaves: text, button, input, image-placeholder, icon-circle, chip, list-row, card, map-block, segmented, bottom-bar, sidebar, stepper, divider, kpi-card, slider, progress, rating, avatar-stack, tag, checkbox-row, toggle-row, chart-bar, chart-line, box.

Use data.{title,meta,trailing,glyph,badge,options,active,value,min,max,rating,reviews,delta,trend,count,series,on,checked,tone}.

Rules:
- Page area 420x720. Root is a vertical stack with padding 2.
- 14-28 leaves with realistic, DOMAIN-SPECIFIC copy and numbers (prices, %, dates, counts).
- One h1 per page; semantic textStyle on every text leaf.
- Pick the SEMANTIC primitive: kpi-card for metrics, chart-line/bar for analytics, rating for reviews, slider for ranges, tag for statuses, icon-circle with data.glyph for category icons.
- Every list-row & card MUST have meaningful data.title + data.meta + data.trailing — never empty.
- Group with nested stacks; use row + widthFrac for two-column rows; use grid only for repeated cards/icons.
No prose, no code fences.`;

export interface RegeneratedNodes {
  nodes: CanvasNode[];
}

export const regeneratePage = async (
  pageName: string,
  brief: string,
  pageId: string,
  fidelity: Fidelity = "wireframe",
): Promise<RegeneratedNodes> => {
  const userMsg = `Page name: "${pageName}"\nBrief: ${brief}`;
  const text = await callProvider(userMsg, PAGE_REGEN_SYSTEM);
  const raw = tryParseJson(text);
  let root = sanitizeIA(raw.root ?? raw.layout ?? raw);
  if (isEmptyRoot(root)) {
    console.warn(`[devcanvas] regen of "${pageName}" returned empty root. Raw:`, raw);
    root = sanitizeIA(fallbackPageIA(pageName));
  }
  const laid = layoutPage({ id: pageId, name: pageName, root } as IAPage, pageId, fidelity);
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
