export type NodeType =
  | "box"
  | "text"
  | "image"
  | "button"
  | "input"
  // ---- wireframe primitives ----
  | "image-placeholder" // grey box with mountain + sun glyph
  | "icon-circle"        // circle with optional letter / lucide-style glyph
  | "chip"               // pill with label, used for filters/tags
  | "list-row"           // thumb + title + meta + trailing price/CTA
  | "card"               // generic card surface (acts like box but rounded + shadowed)
  | "map-block"          // checkered/lined map area with pin
  | "segmented"          // tab strip — pipe-separated content choices
  | "bottom-bar"         // sticky bottom action bar
  | "sidebar"            // vertical nav strip
  | "stepper"            // horizontal step indicator (1 ─ 2 ─ 3)
  | "divider"            // 1px hairline
  // ---- richer wireframe primitives ----
  | "slider"             // horizontal range slider with track + thumb + value
  | "avatar-stack"       // overlapping circular avatars + "+N more"
  | "rating"             // ★★★★☆ + numeric score
  | "progress"           // horizontal progress bar with %
  | "kpi-card"           // dashboard KPI tile: label + big number + delta
  | "tag"                // small status pill (Active / Pending / Failed)
  | "checkbox-row"       // checkbox + label + meta
  | "toggle-row"         // label + meta + iOS-style switch
  | "chart-bar"          // bar chart sparkline
  | "chart-line";        // line chart sparkline

/** Semantic typographic role; pulled from token scale at render-time when set. */
export type TextStyleRole =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "caption"
  | "label";

/** Visual fidelity for generation + rendering. */
export type Fidelity = "wireframe" | "hifi";

/**
 * A subset of style props that can be bound to a token path.
 * Example: tokenRefs.background = "colors.surface"
 */
export interface TokenRefs {
  background?: string;
  color?: string;
  borderColor?: string;
  borderRadius?: string; // e.g. "radius.md"
  fontSize?: string; // e.g. "type.h2"
}

/** Optional structured payload for primitives that have multi-part content. */
export interface NodeData {
  /** list-row */
  title?: string;
  meta?: string;
  trailing?: string;
  /** chip / segmented / stepper */
  options?: string[];
  active?: number;
  /** icon-circle / image-placeholder */
  glyph?: string; // single character or short token
  /** card */
  badge?: string;
  /** slider/progress: 0..100 */
  value?: number;
  /** slider: range labels */
  min?: string;
  max?: string;
  /** rating: 0..5 */
  rating?: number;
  /** rating: review count */
  reviews?: number;
  /** kpi-card: delta string like "+12%" */
  delta?: string;
  /** kpi-card: trend direction */
  trend?: "up" | "down" | "flat";
  /** avatar-stack: count */
  count?: number;
  /** chart: array of values 0..100 */
  series?: number[];
  /** toggle-row */
  on?: boolean;
  /** checkbox-row */
  checked?: boolean;
  /** tag color hint */
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}

export interface CanvasNode {
  id: string;
  pageId: string;
  type: NodeType;
  /** Position is relative to the parent page frame (top-left of the frame's content area). */
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: {
    background?: string;
    color?: string;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    padding?: number;
    fontSize?: number;
    fontWeight?: number;
    display?: "flex" | "block";
    flexDirection?: "row" | "column";
    alignItems?: "start" | "center" | "end";
    justifyContent?: "start" | "center" | "end" | "between";
  };
  content?: string;
  zIndex: number;
  /** Semantic typographic role — when set, fontSize/weight resolve from tokens. */
  textStyle?: TextStyleRole;
  /** Map of style props bound to design-token paths. */
  tokenRefs?: TokenRefs;
  /** When this node is an instance of a saved component, the master id. */
  componentId?: string;
  /** Style/content props the user manually overrode on this instance. */
  instanceOverrides?: Array<keyof CanvasNode | `style.${string}`>;
  /** Multi-part content for list rows, chips, etc. */
  data?: NodeData;
  /** Fidelity hint — wireframe primitives render in monochrome mode. */
  fidelity?: Fidelity;
}

export interface Page {
  id: string;
  name: string;
  /** Display number on the storyboard (1-indexed). 0 = design-system sheet. */
  number?: number;
  /** Top-left of the page frame on the infinite canvas. */
  position: { x: number; y: number };
  size: { width: number; height: number };
  background?: string;
  /** Mark special pages (e.g. design-system sheet) so they get a wider frame. */
  kind?: "screen" | "design-system";
}

/** A directed flow connection from one page to another (or from a node to a page). */
export interface Edge {
  id: string;
  fromPageId: string;
  /** Optional source node — if set, the arrow originates from this element on the page. */
  fromNodeId?: string;
  toPageId: string;
  label?: string;
}

export interface Scene {
  pages: Page[];
  nodes: CanvasNode[];
  edges: Edge[];
}

// =====================================================================
// Default styles
// We keep two looks: "wireframe" (monochrome, the screenshot reference)
// and "hifi" (current colored look). The renderer chooses which to use
// based on node.fidelity.
// =====================================================================

const WIREFRAME = {
  paper: "#ffffff",
  surface: "#f7f7f7",
  surfaceMuted: "#ececec",
  border: "#d6d6d6",
  borderStrong: "#b8b8b8",
  text: "#1a1a1a",
  textMuted: "#7a7a7a",
  accent: "#ee4f3a",
  accentText: "#ffffff",
};

export const wireframePalette = WIREFRAME;

export const defaultStyleFor = (
  type: NodeType,
  fidelity: Fidelity = "hifi",
): CanvasNode["style"] => {
  if (fidelity === "wireframe") {
    switch (type) {
      case "text":
        return { color: WIREFRAME.text, fontSize: 14, fontWeight: 400 };
      case "button":
        return {
          background: WIREFRAME.accent,
          color: WIREFRAME.accentText,
          borderRadius: 4,
          padding: 10,
          fontSize: 13,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        };
      case "input":
        return {
          background: WIREFRAME.paper,
          color: WIREFRAME.textMuted,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
          padding: 8,
          fontSize: 12,
        };
      case "image":
      case "image-placeholder":
        return {
          background: WIREFRAME.surface,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
        };
      case "chip":
        return {
          background: WIREFRAME.paper,
          color: WIREFRAME.text,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
          padding: 6,
          fontSize: 11,
        };
      case "icon-circle":
        return {
          background: WIREFRAME.surface,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
        };
      case "list-row":
      case "card":
        return {
          background: WIREFRAME.paper,
          color: WIREFRAME.text,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
        };
      case "map-block":
        return {
          background: WIREFRAME.surface,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
        };
      case "segmented":
        return {
          background: WIREFRAME.paper,
          color: WIREFRAME.text,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
          fontSize: 11,
        };
      case "bottom-bar":
        return {
          background: WIREFRAME.paper,
          color: WIREFRAME.text,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
        };
      case "sidebar":
        return {
          background: WIREFRAME.surface,
          color: WIREFRAME.text,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
        };
      case "stepper":
        return { color: WIREFRAME.textMuted, fontSize: 11 };
      case "divider":
        return {
          background: WIREFRAME.border,
        };
      case "box":
      default:
        return {
          background: WIREFRAME.paper,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: WIREFRAME.border,
        };
    }
  }

  // ---------- hifi (legacy) ----------
  switch (type) {
    case "text":
      return { color: "#e9e4d8", fontSize: 16, fontWeight: 400 };
    case "button":
      return {
        background: "#d49a3e",
        color: "#1a1714",
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      };
    case "input":
      return {
        background: "#1f1c19",
        color: "#e9e4d8",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#3a342e",
        padding: 10,
        fontSize: 14,
      };
    case "image":
    case "image-placeholder":
      return { background: "#2a2622", borderRadius: 8 };
    case "chip":
      return {
        background: "#1f1c19",
        color: "#e9e4d8",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#3a342e",
        padding: 6,
        fontSize: 12,
      };
    case "icon-circle":
      return {
        background: "#2a2622",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#3a342e",
      };
    case "list-row":
    case "card":
      return {
        background: "#1a1714",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#2a2622",
      };
    case "map-block":
      return { background: "#1a1714", borderRadius: 8, borderWidth: 1, borderColor: "#2a2622" };
    case "segmented":
      return {
        background: "#1f1c19",
        color: "#e9e4d8",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#3a342e",
        fontSize: 12,
      };
    case "bottom-bar":
      return { background: "#1a1714", color: "#e9e4d8", borderWidth: 1, borderColor: "#2a2622" };
    case "sidebar":
      return { background: "#15120f", color: "#e9e4d8", borderWidth: 1, borderColor: "#2a2622" };
    case "stepper":
      return { color: "#9b9588", fontSize: 12 };
    case "divider":
      return { background: "#2a2622" };
    case "box":
    default:
      return {
        background: "#1a1714",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#2a2622",
      };
  }
};

export const defaultContentFor = (type: NodeType): string | undefined => {
  switch (type) {
    case "text":
      return "Text element";
    case "button":
      return "Button";
    case "input":
      return "Placeholder…";
    case "chip":
      return "Filter";
    case "card":
      return "Card title";
    default:
      return undefined;
  }
};

export const defaultSizeFor = (type: NodeType) => {
  switch (type) {
    case "text":
      return { width: 180, height: 28 };
    case "button":
      return { width: 140, height: 44 };
    case "input":
      return { width: 220, height: 40 };
    case "image":
    case "image-placeholder":
      return { width: 220, height: 160 };
    case "chip":
      return { width: 96, height: 28 };
    case "icon-circle":
      return { width: 56, height: 56 };
    case "list-row":
      return { width: 360, height: 72 };
    case "card":
      return { width: 200, height: 160 };
    case "map-block":
      return { width: 360, height: 200 };
    case "segmented":
      return { width: 360, height: 36 };
    case "bottom-bar":
      return { width: 420, height: 64 };
    case "sidebar":
      return { width: 200, height: 720 };
    case "stepper":
      return { width: 360, height: 24 };
    case "divider":
      return { width: 360, height: 1 };
    default:
      return { width: 280, height: 180 };
  }
};

export const defaultPageSize = { width: 420, height: 720 };

export const newPage = (name: string, x: number, y: number, number?: number): Page => ({
  id: `p_${Math.random().toString(36).slice(2, 8)}`,
  name,
  number,
  position: { x, y },
  size: { ...defaultPageSize },
  background: "#ffffff",
  kind: "screen",
});
