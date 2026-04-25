// Layout preview — infers the implicit Stack/Grid structure from the current
// absolute positions of nodes on each page, so the user can SEE how the
// auto-layout engine would arrange things before committing to code.
//
// This runs purely on geometry — no AI call. We cluster sibling nodes into
// rows (similar y) and columns (similar x), then emit container rectangles
// and gap measurements between siblings.

import type { CanvasNode, Page } from "./scene";

const ROW_TOLERANCE = 12; // px — nodes within this y-distance count as same row
const COL_TOLERANCE = 12;

export type ContainerKind = "stack-column" | "stack-row" | "grid";

export interface PreviewContainer {
  /** Page-relative bounds (matches CanvasNode.position coordinate space). */
  x: number;
  y: number;
  width: number;
  height: number;
  kind: ContainerKind;
  /** Number of immediate children represented by this container. */
  count: number;
  /** Most common gap between consecutive children, in px. */
  gap: number;
}

export interface PreviewGap {
  /** Page-relative midpoint of the gap label. */
  x: number;
  y: number;
  /** "v" = vertical gap between two rows; "h" = horizontal between two cols. */
  axis: "v" | "h";
  size: number;
}

export interface PagePreview {
  pageId: string;
  /** Page-relative content bounds (padding ring). */
  pad: { x: number; y: number; width: number; height: number };
  containers: PreviewContainer[];
  gaps: PreviewGap[];
}

const bbox = (ns: CanvasNode[]) => {
  const x1 = Math.min(...ns.map((n) => n.position.x));
  const y1 = Math.min(...ns.map((n) => n.position.y));
  const x2 = Math.max(...ns.map((n) => n.position.x + n.size.width));
  const y2 = Math.max(...ns.map((n) => n.position.y + n.size.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

const mode = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const buckets = new Map<number, number>();
  for (const x of xs) {
    const k = Math.round(x / 4) * 4;
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [k, c] of buckets) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
};

/** Group nodes into horizontal rows by y-overlap. */
const groupRows = (nodes: CanvasNode[]): CanvasNode[][] => {
  const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const rows: CanvasNode[][] = [];
  for (const n of sorted) {
    const ny1 = n.position.y;
    const ny2 = n.position.y + n.size.height;
    const row = rows.find((r) => {
      const ry1 = Math.min(...r.map((m) => m.position.y));
      const ry2 = Math.max(...r.map((m) => m.position.y + m.size.height));
      // overlap test with tolerance
      return ny1 < ry2 + ROW_TOLERANCE && ny2 > ry1 - ROW_TOLERANCE;
    });
    if (row) row.push(n);
    else rows.push([n]);
  }
  // Sort each row by x
  rows.forEach((r) => r.sort((a, b) => a.position.x - b.position.x));
  return rows;
};

export const buildPagePreview = (page: Page, allNodes: CanvasNode[]): PagePreview => {
  const nodes = allNodes.filter((n) => n.pageId === page.id);
  if (nodes.length === 0) {
    return {
      pageId: page.id,
      pad: { x: 24, y: 24, width: page.size.width - 48, height: page.size.height - 48 },
      containers: [],
      gaps: [],
    };
  }

  const all = bbox(nodes);
  const padX = Math.max(8, all.x);
  const padY = Math.max(8, all.y);
  const padW = Math.min(page.size.width - padX, all.width + (all.x - padX) + (page.size.width - all.x - all.width));
  const padH = Math.min(page.size.height - padY, all.height + (all.y - padY) + (page.size.height - all.y - all.height));

  const rows = groupRows(nodes);

  const containers: PreviewContainer[] = [];
  const gaps: PreviewGap[] = [];

  // Vertical stack of rows
  if (rows.length >= 2) {
    const vGaps: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const prevBottom = Math.max(...rows[i - 1].map((n) => n.position.y + n.size.height));
      const currTop = Math.min(...rows[i].map((n) => n.position.y));
      const g = Math.max(0, currTop - prevBottom);
      vGaps.push(g);
      gaps.push({
        x: padX + padW / 2,
        y: (prevBottom + currTop) / 2,
        axis: "v",
        size: Math.round(g),
      });
    }
    containers.push({
      x: all.x - 4,
      y: all.y - 4,
      width: all.width + 8,
      height: all.height + 8,
      kind: "stack-column",
      count: rows.length,
      gap: Math.round(mode(vGaps)),
    });
  }

  // Per-row horizontal stacks / grids
  for (const row of rows) {
    if (row.length < 2) continue;
    const rb = bbox(row);
    const hGaps: number[] = [];
    const widths: number[] = [];
    for (let i = 1; i < row.length; i++) {
      const prevRight = row[i - 1].position.x + row[i - 1].size.width;
      const currLeft = row[i].position.x;
      const g = Math.max(0, currLeft - prevRight);
      hGaps.push(g);
      gaps.push({
        x: (prevRight + currLeft) / 2,
        y: rb.y + rb.height / 2,
        axis: "h",
        size: Math.round(g),
      });
      widths.push(row[i].size.width);
    }
    widths.push(row[0].size.width);
    // If most siblings have the same width AND the same gap, treat as grid.
    const widthVariance = Math.max(...widths) - Math.min(...widths);
    const gapVariance = hGaps.length ? Math.max(...hGaps) - Math.min(...hGaps) : 0;
    const isGrid = row.length >= 3 && widthVariance <= 4 && gapVariance <= 4;
    containers.push({
      x: rb.x - 3,
      y: rb.y - 3,
      width: rb.width + 6,
      height: rb.height + 6,
      kind: isGrid ? "grid" : "stack-row",
      count: row.length,
      gap: Math.round(mode(hGaps)),
    });
  }

  return {
    pageId: page.id,
    pad: { x: padX, y: padY, width: padW, height: padH },
    containers,
    gaps,
  };
};

export const buildScenePreview = (pages: Page[], nodes: CanvasNode[]): PagePreview[] =>
  pages.map((p) => buildPagePreview(p, nodes));

export const containerLabel = (k: ContainerKind): string => {
  switch (k) {
    case "stack-column":
      return "Stack ↓";
    case "stack-row":
      return "Stack →";
    case "grid":
      return "Grid";
  }
};
