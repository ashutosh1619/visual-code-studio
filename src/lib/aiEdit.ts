import type { CanvasNode, Page, Edge, NodeType } from "./scene";
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

const buildUrl = (cfg: ProviderConfig, providerId: string) => {
  if (providerId === "azure") {
    const base = cfg.baseUrl.replace(/\/$/, "");
    return `${base}/openai/deployments/${cfg.deployment}/chat/completions?api-version=${cfg.apiVersion ?? "2024-08-01-preview"}`;
  }
  if (providerId === "anthropic") return `${cfg.baseUrl.replace(/\/$/, "")}/messages`;
  if (providerId === "google")
    return `${cfg.baseUrl.replace(/\/$/, "")}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
  return `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
};

const buildHeaders = (cfg: ProviderConfig, providerId: string): HeadersInit => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (providerId === "azure") h["api-key"] = cfg.apiKey;
  else if (providerId === "anthropic") {
    h["x-api-key"] = cfg.apiKey;
    h["anthropic-version"] = "2023-06-01";
    h["anthropic-dangerous-direct-browser-access"] = "true";
  } else if (providerId === "google") {/* key in URL */}
  else if (cfg.apiKey) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  return h;
};

const buildBody = (
  cfg: ProviderConfig,
  providerId: string,
  systemPrompt: string,
  userPrompt: string,
  imageDataUrl?: string,
) => {
  if (providerId === "anthropic") {
    const content: any[] = [{ type: "text", text: userPrompt }];
    if (imageDataUrl) {
      const [meta, b64] = imageDataUrl.split(",");
      const media = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png";
      content.unshift({
        type: "image",
        source: { type: "base64", media_type: media, data: b64 },
      });
    }
    return {
      model: cfg.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    };
  }
  if (providerId === "google") {
    const parts: any[] = [{ text: userPrompt }];
    if (imageDataUrl) {
      const [meta, b64] = imageDataUrl.split(",");
      const media = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png";
      parts.unshift({ inline_data: { mime_type: media, data: b64 } });
    }
    return {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    };
  }
  // OpenAI-compatible
  const content: any =
    imageDataUrl
      ? [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ]
      : userPrompt;
  return {
    model: providerId === "azure" ? undefined : cfg.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  };
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

const callModel = async (
  systemPrompt: string,
  userPrompt: string,
  opts?: { imageDataUrl?: string; expectJson?: boolean },
): Promise<string> => {
  const state = loadProviders();
  if (!state) throw new Error("No provider configured. Open Settings.");
  const providerId = state.active;
  const cfg = state.providers[providerId];
  if (!cfg) throw new Error("Active provider not found.");
  if (providerId !== "ollama" && !cfg.apiKey)
    throw new Error(`Add an API key for ${providerId} in Settings.`);
  if (providerId === "azure" && !cfg.deployment)
    throw new Error("Azure OpenAI requires a deployment name.");

  const body = buildBody(cfg, providerId, systemPrompt, userPrompt, opts?.imageDataUrl);
  // For non-JSON expectations remove response_format
  if (!opts?.expectJson && providerId !== "anthropic" && providerId !== "google") {
    delete (body as any).response_format;
  }

  const resp = await fetch(buildUrl(cfg, providerId), {
    method: "POST",
    headers: buildHeaders(cfg, providerId),
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
};

// ---------- Inline edit on selection ----------

const INLINE_SYSTEM = `You are a UI rewrite engine. Given an existing element selection (JSON) and an instruction, return a JSON patch that mutates them. Output STRICT JSON with this shape:
{
  "updates": [ { "id": "string", "patch": { /* partial of CanvasNode (position/size/style/content) */ } } ],
  "additions": [ /* full CanvasNode objects to add — pageId must be supplied from input context */ ]
}
Only return the JSON. No prose.`;

export interface InlineEditResult {
  updates: { id: string; patch: Partial<CanvasNode> }[];
  additions: CanvasNode[];
}

export const inlineEdit = async (
  selectionNodes: CanvasNode[],
  instruction: string,
  pageContext: Page,
): Promise<InlineEditResult> => {
  const compactSelection = selectionNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    size: n.size,
    style: n.style,
    content: n.content,
  }));
  const userPrompt = `Page: ${pageContext.name} (${pageContext.size.width}x${pageContext.size.height}).
Selected elements:\n${JSON.stringify(compactSelection)}\n
Instruction: ${instruction}`;
  const text = await callModel(INLINE_SYSTEM, userPrompt, { expectJson: true });
  const parsed = tryParseJson(text);
  const additions: CanvasNode[] = (parsed.additions ?? []).map((a: any) => ({
    id: `n_${Math.random().toString(36).slice(2, 8)}`,
    pageId: pageContext.id,
    type: (["box", "text", "image", "button", "input"] as NodeType[]).includes(a.type) ? a.type : "box",
    position: a.position ?? { x: 20, y: 20 },
    size: a.size ?? defaultSizeFor(a.type ?? "box"),
    style: { ...defaultStyleFor(a.type ?? "box"), ...(a.style ?? {}) },
    content: a.content,
    zIndex: Date.now() % 1_000_000,
  }));
  return { updates: parsed.updates ?? [], additions };
};

// ---------- Page re-prompt ----------

const PAGE_REPROMPT_SYSTEM = `Redesign a single page wireframe. Return STRICT JSON:
{
  "nodes": [
    { "type": "box"|"text"|"image"|"button"|"input", "x": number, "y": number, "width": number, "height": number, "content"?: "string" }
  ]
}
Coordinates are relative to the page (0,0) top-left. Stay inside the page bounds with 20px padding. 6-14 elements.`;

export const repromptPage = async (
  page: Page,
  instruction: string,
): Promise<CanvasNode[]> => {
  const userPrompt = `Page name: ${page.name}. Size: ${page.size.width}x${page.size.height}. Breakpoint: ${page.breakpoint ?? "mobile"}.
New instruction: ${instruction}`;
  const text = await callModel(PAGE_REPROMPT_SYSTEM, userPrompt, { expectJson: true });
  const parsed = tryParseJson(text);
  return (parsed.nodes ?? []).map((n: any, i: number) => ({
    id: `n_${Math.random().toString(36).slice(2, 8)}`,
    pageId: page.id,
    type: (["box", "text", "image", "button", "input"] as NodeType[]).includes(n.type) ? n.type : "box",
    position: {
      x: Math.max(0, Math.min(page.size.width - 20, Number(n.x ?? 20))),
      y: Math.max(0, Math.min(page.size.height - 20, Number(n.y ?? 20))),
    },
    size: {
      width: Math.max(20, Number(n.width ?? defaultSizeFor(n.type).width)),
      height: Math.max(20, Number(n.height ?? defaultSizeFor(n.type).height)),
    },
    style: defaultStyleFor(n.type ?? "box"),
    content: n.content,
    zIndex: i + 1,
  }));
};

// ---------- Vision: screenshot/sketch -> wireframe ----------

const VISION_SYSTEM = `You are a UI vision-to-wireframe converter. Given a screenshot or sketch, output STRICT JSON:
{
  "pages": [{ "id": "string", "name": "string" }],
  "nodes": [{ "pageId": "string", "type": "box"|"text"|"image"|"button"|"input", "x": number, "y": number, "width": number, "height": number, "content"?: "string" }],
  "edges": [{ "from": "pageId", "to": "pageId", "label"?: "string" }]
}
Page canvas is 420x720. Stay inside with 20px padding. One page if a single screen. No prose.`;

export const visionToWireframe = async (
  imageDataUrl: string,
  hint?: string,
): Promise<{ pages: any[]; nodes: any[]; edges: any[] }> => {
  const userPrompt = hint
    ? `Convert this design into a structured wireframe. Hint: ${hint}`
    : "Convert this design into a structured wireframe.";
  const text = await callModel(VISION_SYSTEM, userPrompt, {
    imageDataUrl,
    expectJson: true,
  });
  return tryParseJson(text);
};

// ---------- Design critic ----------

export interface CriticIssue {
  severity: "info" | "warn" | "error";
  message: string;
  nodeId?: string;
  fix?: string;
}

const CRITIC_SYSTEM = `You are a senior product designer reviewing a wireframe. Return STRICT JSON:
{ "issues": [{ "severity": "info"|"warn"|"error", "message": "string", "nodeId"?: "string", "fix"?: "string" }] }
Focus on: visual hierarchy, contrast, spacing rhythm, alignment, accessibility, missing states (empty/loading/error). Be specific. 4-10 items max.`;

export const designCritic = async (page: Page, nodes: CanvasNode[]): Promise<CriticIssue[]> => {
  const compact = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    size: n.size,
    style: n.style,
    content: n.content,
  }));
  const userPrompt = `Review this page.\nPage: ${page.name} (${page.size.width}x${page.size.height})\nNodes:\n${JSON.stringify(compact)}`;
  const text = await callModel(CRITIC_SYSTEM, userPrompt, { expectJson: true });
  const parsed = tryParseJson(text);
  return parsed.issues ?? [];
};

// ---------- Image generation (placeholders) ----------

export const generatePlaceholderImage = async (prompt: string): Promise<string> => {
  const state = loadProviders();
  if (!state) throw new Error("No provider configured. Open Settings.");
  const providerId = state.active;
  const cfg = state.providers[providerId];
  if (!cfg) throw new Error("Active provider not found.");

  // Try OpenAI-style images endpoint first when applicable
  if (providerId === "openai" || providerId === "azure") {
    const url =
      providerId === "azure"
        ? `${cfg.baseUrl.replace(/\/$/, "")}/openai/deployments/${cfg.deployment}/images/generations?api-version=${cfg.apiVersion ?? "2024-08-01-preview"}`
        : `${cfg.baseUrl.replace(/\/$/, "")}/images/generations`;
    const resp = await fetch(url, {
      method: "POST",
      headers: buildHeaders(cfg, providerId),
      body: JSON.stringify({
        model: providerId === "azure" ? undefined : "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
        response_format: "b64_json",
      }),
    });
    if (!resp.ok) throw new Error(`Image gen ${resp.status}`);
    const json = await resp.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    return `data:image/png;base64,${b64}`;
  }

  // Google Gemini image model
  if (providerId === "google") {
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/models/gemini-2.5-flash-image:generateContent?key=${cfg.apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });
    if (!resp.ok) throw new Error(`Image gen ${resp.status}`);
    const json = await resp.json();
    const part = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inline_data || p.inlineData);
    const inline = part?.inline_data ?? part?.inlineData;
    if (!inline) throw new Error("No image returned");
    return `data:${inline.mime_type ?? inline.mimeType ?? "image/png"};base64,${inline.data}`;
  }

  throw new Error(`Image generation not supported for provider "${providerId}". Use OpenAI, Azure, or Google.`);
};
