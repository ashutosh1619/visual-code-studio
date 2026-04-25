// Design tokens — colors, type scale, radii. Applied to the scene as a whole
// so toggling a theme cascades through every node that opted into the token.
//
// v2: nodes record `tokenRefs` (which style prop came from which token path)
// and `textStyle` (semantic role: h1/h2/body/...). When tokens change, we
// rewrite ONLY the bound props — manual overrides survive.

import type { CanvasNode, Page, TextStyleRole, TokenRefs } from "./scene";

export interface DesignTokens {
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentText: string;
  };
  type: {
    /** base font size in px; the rest of the scale is derived */
    base: number;
    /** ratio used to derive the modular scale */
    scale: number;
    fontFamily: "sans" | "serif" | "mono";
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
}

export const PRESET_THEMES: Record<string, { name: string; tokens: DesignTokens }> = {
  ember: {
    name: "Ember",
    tokens: {
      colors: {
        background: "#0f0d0b",
        surface: "#1a1714",
        surfaceMuted: "#2a2622",
        border: "#3a342e",
        text: "#e9e4d8",
        textMuted: "#9b9588",
        accent: "#d49a3e",
        accentText: "#1a1714",
      },
      type: { base: 14, scale: 1.25, fontFamily: "sans" },
      radius: { sm: 6, md: 10, lg: 16 },
    },
  },
  paper: {
    name: "Paper",
    tokens: {
      colors: {
        background: "#f5f1e8",
        surface: "#ffffff",
        surfaceMuted: "#ece6d6",
        border: "#d9d2bf",
        text: "#1f1c19",
        textMuted: "#6c655a",
        accent: "#c45a3b",
        accentText: "#ffffff",
      },
      type: { base: 14, scale: 1.2, fontFamily: "serif" },
      radius: { sm: 4, md: 6, lg: 10 },
    },
  },
  midnight: {
    name: "Midnight",
    tokens: {
      colors: {
        background: "#0a0d14",
        surface: "#121826",
        surfaceMuted: "#1d2638",
        border: "#2a3550",
        text: "#dde6f5",
        textMuted: "#7a87a3",
        accent: "#7aa2f7",
        accentText: "#0a0d14",
      },
      type: { base: 14, scale: 1.333, fontFamily: "sans" },
      radius: { sm: 8, md: 12, lg: 20 },
    },
  },
  brutalist: {
    name: "Brutalist",
    tokens: {
      colors: {
        background: "#ffffff",
        surface: "#ffffff",
        surfaceMuted: "#f0f0f0",
        border: "#000000",
        text: "#000000",
        textMuted: "#444444",
        accent: "#ff3b1c",
        accentText: "#ffffff",
      },
      type: { base: 14, scale: 1.414, fontFamily: "mono" },
      radius: { sm: 0, md: 0, lg: 0 },
    },
  },
};

export const DEFAULT_THEME_KEY = "ember";

/** Compute the px size for a semantic text role from the type scale. */
export const textRoleSize = (role: TextStyleRole, t: DesignTokens): number => {
  const { base, scale } = t.type;
  switch (role) {
    case "display":
      return Math.round(base * Math.pow(scale, 4));
    case "h1":
      return Math.round(base * Math.pow(scale, 3));
    case "h2":
      return Math.round(base * Math.pow(scale, 2));
    case "h3":
      return Math.round(base * scale);
    case "body":
      return base;
    case "caption":
    case "label":
      return Math.max(11, Math.round(base / scale));
  }
};

/** Resolve a token path like "colors.surface" against current tokens. */
export const resolveToken = (path: string, t: DesignTokens): string | number | undefined => {
  const [group, key] = path.split(".");
  const g = (t as any)[group];
  return g ? g[key] : undefined;
};

/** Did the user manually override this style prop? Then we DO NOT rebind it. */
const isOverridden = (
  node: CanvasNode,
  prop: keyof CanvasNode["style"],
): boolean => {
  const k = `style.${prop}` as const;
  return Array.isArray(node.instanceOverrides) && node.instanceOverrides.includes(k as any);
};

/** Bind common token slots based on element type — produces tokenRefs. */
const defaultRefsFor = (node: CanvasNode): TokenRefs => {
  switch (node.type) {
    case "text":
      return { color: "colors.text" };
    case "button":
      return {
        background: "colors.accent",
        color: "colors.accentText",
        borderRadius: "radius.md",
      };
    case "input":
      return {
        background: "colors.surface",
        color: "colors.text",
        borderColor: "colors.border",
        borderRadius: "radius.sm",
      };
    case "image":
      return { background: "colors.surfaceMuted", borderRadius: "radius.md" };
    case "box":
    default:
      return {
        background: "colors.surface",
        borderColor: "colors.border",
        borderRadius: "radius.lg",
      };
  }
};

/** Apply tokens to a single node, respecting tokenRefs + overrides + textStyle. */
const applyToNode = (node: CanvasNode, t: DesignTokens): CanvasNode => {
  const refs: TokenRefs = node.tokenRefs ?? defaultRefsFor(node);
  const next = { ...node, tokenRefs: refs, style: { ...node.style } };

  const setIfBound = (
    prop: keyof TokenRefs,
    target: keyof CanvasNode["style"],
  ) => {
    const path = refs[prop];
    if (!path) return;
    if (isOverridden(node, target)) return;
    const v = resolveToken(path, t);
    if (v !== undefined) (next.style as any)[target] = v;
  };

  setIfBound("background", "background");
  setIfBound("color", "color");
  setIfBound("borderColor", "borderColor");
  setIfBound("borderRadius", "borderRadius");

  // Type scale via textStyle role — only when role is set and not overridden.
  if (node.type === "text" && node.textStyle && !isOverridden(node, "fontSize")) {
    next.style.fontSize = textRoleSize(node.textStyle, t);
    if (
      !isOverridden(node, "fontWeight") &&
      (node.textStyle === "display" || node.textStyle === "h1" || node.textStyle === "h2")
    ) {
      next.style.fontWeight = 600;
    }
  } else if (node.type === "button" && !isOverridden(node, "fontSize")) {
    next.style.fontSize = t.type.base;
  } else if (node.type === "input" && !isOverridden(node, "fontSize")) {
    next.style.fontSize = t.type.base;
  }

  return next;
};

export const applyTokensToScene = (
  scene: { pages: Page[]; nodes: CanvasNode[] },
  tokens: DesignTokens,
): { pages: Page[]; nodes: CanvasNode[] } => ({
  pages: scene.pages.map((p) => ({ ...p, background: tokens.colors.background })),
  nodes: scene.nodes.map((n) => applyToNode(n, tokens)),
});

/**
 * Mark a style prop on a node as a manual override (so future theme switches
 * don't clobber it). Call this from the inspector when the user edits a value.
 */
export const markOverride = (
  node: CanvasNode,
  prop: keyof CanvasNode["style"],
): CanvasNode => {
  const key = `style.${prop}` as const;
  const prev = node.instanceOverrides ?? [];
  if (prev.includes(key as any)) return node;
  return { ...node, instanceOverrides: [...prev, key as any] };
};

/** Persisted slice. */
const STORAGE_KEY = "devcanvas:tokens";

export const loadTokens = (): { themeKey: string; tokens: DesignTokens } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { themeKey: DEFAULT_THEME_KEY, tokens: PRESET_THEMES[DEFAULT_THEME_KEY].tokens };
};

export const saveTokens = (themeKey: string, tokens: DesignTokens) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeKey, tokens }));
};
