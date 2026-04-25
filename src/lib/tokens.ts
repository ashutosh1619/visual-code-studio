// Design tokens — colors, type scale, radii. Applied to the scene as a whole
// so toggling a theme cascades through every node that opted into the token.
//
// Nodes still store concrete style values (background "#d49a3e" etc.) so we
// keep render fast and codegen straightforward. The optional `tokenRefs` map
// records which node properties came from which token; when a token changes we
// rewrite those properties in one pass.

import type { CanvasNode, Page, Scene } from "./scene";

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
    /** small (inputs), medium (cards), large (frames) */
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

/** Map a node type to the conventional token slot it pulls from. */
const tokenizeNode = (node: CanvasNode, t: DesignTokens): CanvasNode => {
  const ts = t.type;
  const fontMap = { sans: undefined, serif: undefined, mono: undefined };
  // We don't change the family per node here (handled at the page-level CSS),
  // but we use the type scale to size text consistently.
  switch (node.type) {
    case "text": {
      // Preserve relative size: we treat the existing fontSize as a scale step.
      // Default body = base; >18px = h2 (scale^2); >24px = h1 (scale^3).
      const current = node.style.fontSize ?? ts.base;
      let next = ts.base;
      if (current >= 24) next = Math.round(ts.base * Math.pow(ts.scale, 3));
      else if (current >= 18) next = Math.round(ts.base * Math.pow(ts.scale, 2));
      else if (current >= 16) next = Math.round(ts.base * ts.scale);
      return {
        ...node,
        style: { ...node.style, color: t.colors.text, fontSize: next },
      };
    }
    case "button":
      return {
        ...node,
        style: {
          ...node.style,
          background: t.colors.accent,
          color: t.colors.accentText,
          borderRadius: t.radius.md,
          fontSize: ts.base,
        },
      };
    case "input":
      return {
        ...node,
        style: {
          ...node.style,
          background: t.colors.surface,
          color: t.colors.text,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radius.sm,
          fontSize: ts.base,
        },
      };
    case "image":
      return {
        ...node,
        style: { ...node.style, background: t.colors.surfaceMuted, borderRadius: t.radius.md },
      };
    case "box":
    default:
      return {
        ...node,
        style: {
          ...node.style,
          background: t.colors.surface,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radius.lg,
        },
      };
  }
};

export const applyTokensToScene = (
  scene: { pages: Page[]; nodes: CanvasNode[] },
  tokens: DesignTokens,
): { pages: Page[]; nodes: CanvasNode[] } => ({
  pages: scene.pages.map((p) => ({ ...p, background: tokens.colors.background })),
  nodes: scene.nodes.map((n) => tokenizeNode(n, tokens)),
});

/** Persisted slice on the scene. */
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
