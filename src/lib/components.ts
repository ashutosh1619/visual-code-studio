// Reusable component primitives — save a selection as a "component", drop
// instances onto pages. Master edits don't propagate yet (out of scope for
// the MVP slice) but the data model leaves room: instances carry a
// `componentId` so a future pass can rebuild them from the master template.

import type { CanvasNode } from "./scene";

export interface SavedComponent {
  id: string;
  name: string;
  /** Bounding box of the original selection */
  bounds: { width: number; height: number };
  /** Nodes stored with origin-relative positions */
  nodes: Omit<CanvasNode, "id" | "pageId" | "zIndex">[];
  createdAt: number;
}

const STORAGE_KEY = "devcanvas:components";

export const loadComponents = (): SavedComponent[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedComponent[]) : [];
  } catch {
    return [];
  }
};

export const saveComponents = (list: SavedComponent[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

/** Build a component from a list of selected nodes. */
export const componentFromNodes = (
  nodes: CanvasNode[],
  name: string,
): SavedComponent => {
  if (nodes.length === 0) {
    throw new Error("Select at least one element to save as a component");
  }
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n) => n.position.x + n.size.width));
  const maxY = Math.max(...nodes.map((n) => n.position.y + n.size.height));
  return {
    id: `cmp_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Component",
    bounds: { width: maxX - minX, height: maxY - minY },
    nodes: nodes.map(({ id: _i, pageId: _p, zIndex: _z, ...rest }) => ({
      ...rest,
      position: { x: rest.position.x - minX, y: rest.position.y - minY },
    })),
    createdAt: Date.now(),
  };
};

/** Materialize an instance of a saved component into the scene. */
export const instantiateComponent = (
  cmp: SavedComponent,
  pageId: string,
  origin: { x: number; y: number },
  zStart = 1,
): CanvasNode[] => {
  return cmp.nodes.map((n, i) => ({
    ...n,
    id: `n_${Math.random().toString(36).slice(2, 8)}`,
    pageId,
    position: { x: origin.x + n.position.x, y: origin.y + n.position.y },
    zIndex: zStart + i,
  }));
};
