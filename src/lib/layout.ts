// Layout engine — converts an Information Architecture (IA) tree into a flat
// list of CanvasNodes with non-overlapping positions snapped to an 8pt grid.
//
// Why this exists: when the AI emits raw absolute positions, you get the
// overlapping mess we saw in the screenshot. By giving the AI a *semantic*
// vocabulary (sections, stacks, grids) and computing pixels deterministically
// here, every page is guaranteed to be aligned, padded, and readable.

import type { CanvasNode, NodeType, NodeData, TextStyleRole, Fidelity } from "./scene";
import { defaultStyleFor } from "./scene";

const GRID = 8;
const snap = (n: number) => Math.round(n / GRID) * GRID;

export interface IANode {
  /** Layout primitive or leaf type. */
  kind: "stack" | "grid" | "leaf";
  /** Element type when kind === "leaf". */
  type?: NodeType;
  /** Text content / button label / input placeholder. */
  content?: string;
  /** Semantic role for typography sizing. */
  textStyle?: TextStyleRole;
  /** Hint at desired height (leaves) — actual layout may grow it. */
  height?: number;
  /** Hint at desired width fraction (0..1) within parent row. Used in stacks. */
  widthFrac?: number;
  /** Stack/grid direction. */
  direction?: "row" | "column";
  /** Gap between children in grid units (default 2 = 16px). */
  gap?: number;
  /** Grid columns. */
  columns?: number;
  /** Children for stack/grid. */
  children?: IANode[];
  /** Background tone hint for boxes/sections. */
  tone?: "surface" | "muted" | "transparent";
  /** Visual padding inside container in grid units. */
  padding?: number;
  /** Multi-part content for primitives that need it (list-row, chip, etc.). */
  data?: NodeData;
}

export interface IAPage {
  id: string;
  name: string;
  /** Root container — usually a vertical stack with sections. */
  root: IANode;
}

export interface IADocument {
  pages: IAPage[];
  edges: Array<{ from: string; to: string; label?: string }>;
}

const PAGE_W = 420;
const PAGE_H = 720;
const PAGE_PAD = 24;

const TEXT_LINE_HEIGHT: Record<TextStyleRole, number> = {
  display: 40,
  h1: 32,
  h2: 26,
  h3: 22,
  body: 20,
  caption: 16,
  label: 18,
};

const TEXT_FONT: Record<TextStyleRole, number> = {
  display: 30,
  h1: 24,
  h2: 19,
  h3: 16,
  body: 13,
  caption: 11,
  label: 12,
};

// Approx average glyph width as a fraction of font size — used to estimate
// how many characters fit in a given pixel width and therefore how many
// lines a string will wrap to.
const CHAR_WIDTH_FACTOR = 0.55;

const estimateLines = (text: string, fontSize: number, widthPx: number): number => {
  if (!text) return 1;
  const charsPerLine = Math.max(4, Math.floor(widthPx / (fontSize * CHAR_WIDTH_FACTOR)));
  // Honour explicit line breaks too.
  const explicit = text.split("\n");
  let total = 0;
  for (const line of explicit) {
    total += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return total;
};

const leafHeight = (n: IANode, widthPx: number): number => {
  if (n.height) return snap(n.height);
  switch (n.type) {
    case "text": {
      const role = n.textStyle ?? "body";
      const lines = estimateLines(n.content ?? "", TEXT_FONT[role], widthPx);
      return snap(lines * TEXT_LINE_HEIGHT[role]);
    }
    case "button":
      return 40;
    case "input":
      return 40;
    case "image":
    case "image-placeholder":
      // Use a 16:9 aspect-ratio so image placeholders feel "real" instead of
      // shrinking to a thin strip when the column is wide.
      return Math.max(96, snap(widthPx * 0.56));
    case "chip":
      return 32;
    case "icon-circle":
      return Math.min(64, Math.max(40, snap(widthPx)));
    case "list-row":
      return 80;
    case "card":
      return Math.max(160, snap(widthPx * 1.05));
    case "map-block":
      return Math.max(180, snap(widthPx * 0.6));
    case "segmented":
      return 40;
    case "bottom-bar":
      return 64;
    case "stepper":
      return 40;
    case "divider":
      return 8;
    case "slider":
      return 56;
    case "progress":
      return 28;
    case "kpi-card":
      return 112;
    case "rating":
      return 28;
    case "avatar-stack":
      return 36;
    case "tag":
      return 24;
    case "checkbox-row":
    case "toggle-row":
      return 60;
    case "chart-bar":
    case "chart-line":
      return Math.max(120, snap(widthPx * 0.45));
    case "box":
      return 80;
    default:
      return 32;
  }
};

interface LaidOut {
  nodes: CanvasNode[];
  /** Total measured height of this subtree. */
  height: number;
}

const uid = () => `n_${Math.random().toString(36).slice(2, 8)}`;

const buildLeaf = (
  n: IANode,
  pageId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  fidelity: Fidelity,
): CanvasNode => {
  const type = (n.type ?? "box") as NodeType;
  const style = { ...defaultStyleFor(type, fidelity) };
  if (type === "text" && n.textStyle) {
    style.fontSize = TEXT_FONT[n.textStyle];
    if (n.textStyle === "display" || n.textStyle === "h1" || n.textStyle === "h2") {
      style.fontWeight = 600;
    } else if (n.textStyle === "label") {
      style.fontWeight = 500;
    }
  }
  return {
    id: uid(),
    pageId,
    type,
    position: { x: snap(x), y: snap(y) },
    size: { width: snap(w), height: snap(h) },
    style,
    content: n.content,
    zIndex: z,
    textStyle: type === "text" ? n.textStyle : undefined,
    data: n.data,
    fidelity,
  };
};

const layoutNode = (
  n: IANode,
  pageId: string,
  x: number,
  y: number,
  w: number,
  zStart: number,
  fidelity: Fidelity,
): LaidOut => {
  if (n.kind === "leaf") {
    const h = leafHeight(n, w);
    return {
      nodes: [buildLeaf(n, pageId, x, y, w, h, zStart, fidelity)],
      height: h,
    };
  }

  const padding = (n.padding ?? 0) * GRID;
  const gap = (n.gap ?? 2) * GRID;
  const innerX = x + padding;
  const innerY = y + padding;
  const innerW = w - padding * 2;
  const out: CanvasNode[] = [];
  let z = zStart;

  if (n.kind === "grid") {
    const cols = Math.max(1, n.columns ?? 2);
    const cellW = (innerW - gap * (cols - 1)) / cols;
    const children = n.children ?? [];
    let row = 0;
    let col = 0;
    let rowMaxH = 0;
    let cursorY = innerY;
    for (const c of children) {
      const cx = innerX + col * (cellW + gap);
      const cy = cursorY;
      const laid = layoutNode(c, pageId, cx, cy, cellW, z + 1, fidelity);
      out.push(...laid.nodes);
      z += laid.nodes.length;
      rowMaxH = Math.max(rowMaxH, laid.height);
      col++;
      if (col >= cols) {
        col = 0;
        row++;
        cursorY += rowMaxH + gap;
        rowMaxH = 0;
      }
    }
    const totalH = (col === 0 ? cursorY - gap : cursorY + rowMaxH) - innerY;
    return { nodes: out, height: totalH + padding * 2 };
  }

  // stack
  const direction = n.direction ?? "column";
  const children = n.children ?? [];

  if (direction === "row") {
    // Distribute width by widthFrac, default equal split.
    const totalFrac = children.reduce((s, c) => s + (c.widthFrac ?? 1), 0) || 1;
    const usableW = innerW - gap * Math.max(0, children.length - 1);
    let cursorX = innerX;
    let rowMaxH = 0;
    for (const c of children) {
      const childW = (usableW * (c.widthFrac ?? 1)) / totalFrac;
      const laid = layoutNode(c, pageId, cursorX, innerY, childW, z + 1, fidelity);
      out.push(...laid.nodes);
      z += laid.nodes.length;
      rowMaxH = Math.max(rowMaxH, laid.height);
      cursorX += childW + gap;
    }
    return { nodes: out, height: rowMaxH + padding * 2 };
  }

  // column
  let cursorY = innerY;
  for (const c of children) {
    const laid = layoutNode(c, pageId, innerX, cursorY, innerW, z + 1, fidelity);
    out.push(...laid.nodes);
    z += laid.nodes.length;
    cursorY += laid.height + gap;
  }
  const totalH = cursorY - gap - innerY;
  return { nodes: out, height: totalH + padding * 2 };
};

export interface LaidOutPage {
  pageId: string;
  nodes: CanvasNode[];
}

export const layoutPage = (
  page: IAPage,
  pageId: string,
  fidelity: Fidelity = "wireframe",
): LaidOutPage => {
  const { nodes } = layoutNode(
    page.root,
    pageId,
    PAGE_PAD,
    PAGE_PAD,
    PAGE_W - PAGE_PAD * 2,
    1,
    fidelity,
  );
  // Clip nodes that would overflow the page height — prefer letting them sit
  // at the bottom edge rather than escape the frame.
  return {
    pageId,
    nodes: nodes.map((n) => {
      const maxY = PAGE_H - PAGE_PAD - n.size.height;
      return {
        ...n,
        position: {
          x: Math.max(PAGE_PAD, Math.min(PAGE_W - PAGE_PAD - n.size.width, n.position.x)),
          y: Math.max(PAGE_PAD, Math.min(maxY, n.position.y)),
        },
      };
    }),
  };
};

/** Convenience: a sane default IA root for a single page (used as fallback). */
export const fallbackPageIA = (name: string): IANode => ({
  kind: "stack",
  direction: "column",
  padding: 0,
  gap: 2,
  children: [
    { kind: "leaf", type: "text", textStyle: "h1", content: name },
    { kind: "leaf", type: "text", textStyle: "body", content: "Page content goes here." },
    { kind: "leaf", type: "button", content: "Primary action" },
  ],
});
