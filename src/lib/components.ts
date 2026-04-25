// Reusable component primitives — save a selection as a "component", drop
// instances onto pages. v2: instances carry `componentId` and an
// `instanceOverrides` list; editing the master propagates style/content/size
// changes to all instances EXCEPT for props the user manually overrode.

import type { CanvasNode } from "./scene";

export interface SavedComponent {
  id: string;
  name: string;
  /** Bounding box of the original selection */
  bounds: { width: number; height: number };
  /** Nodes stored with origin-relative positions. Position is preserved as the
   *  per-child offset from the component origin so propagation can adjust
   *  layout-aware children too. */
  nodes: Array<Omit<CanvasNode, "id" | "pageId" | "zIndex">>;
  createdAt: number;
  /** Monotonic version — bump on every master edit so instance refresh
   *  policies (future: stale badges) can react. */
  version: number;
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
    nodes: nodes.map(({ id: _i, pageId: _p, zIndex: _z, componentId: _c, instanceOverrides: _o, ...rest }) => ({
      ...rest,
      position: { x: rest.position.x - minX, y: rest.position.y - minY },
    })),
    createdAt: Date.now(),
    version: 1,
  };
};

/** Materialize an instance of a saved component into the scene.
 *  Each child carries `componentId` so future master edits cascade, plus an
 *  `instanceChildIndex` (encoded in zIndex offset) so we can match children. */
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
    componentId: `${cmp.id}#${i}`, // master-id#child-index for stable matching
    instanceOverrides: [],
  }));
};

/**
 * Update master from one of its instances (called when the user does
 * "Update master with this instance"). The selected instance's children
 * become the new template.
 */
export const updateMasterFromInstance = (
  cmp: SavedComponent,
  instanceNodes: CanvasNode[],
): SavedComponent => {
  if (instanceNodes.length === 0) return cmp;
  const minX = Math.min(...instanceNodes.map((n) => n.position.x));
  const minY = Math.min(...instanceNodes.map((n) => n.position.y));
  const maxX = Math.max(...instanceNodes.map((n) => n.position.x + n.size.width));
  const maxY = Math.max(...instanceNodes.map((n) => n.position.y + n.size.height));
  // Sort by encoded child index so the new template aligns with old indices.
  const sorted = [...instanceNodes].sort((a, b) => {
    const ai = parseInt(a.componentId?.split("#")[1] ?? "0", 10);
    const bi = parseInt(b.componentId?.split("#")[1] ?? "0", 10);
    return ai - bi;
  });
  return {
    ...cmp,
    bounds: { width: maxX - minX, height: maxY - minY },
    version: cmp.version + 1,
    nodes: sorted.map(({ id: _i, pageId: _p, zIndex: _z, componentId: _c, instanceOverrides: _o, ...rest }) => ({
      ...rest,
      position: { x: rest.position.x - minX, y: rest.position.y - minY },
    })),
  };
};

/**
 * Cascade master edits to every existing instance in the scene.
 * Instance children are matched by the `#index` suffix of `componentId`.
 * For each child, props in `instanceOverrides` are preserved.
 */
export const propagateMasterToInstances = (
  cmp: SavedComponent,
  sceneNodes: CanvasNode[],
): CanvasNode[] => {
  // Group instances by their component-instance origin (lowest position child),
  // since we only have a flat list. We use a simple per-child mapping: any node
  // whose componentId starts with `${cmp.id}#` gets its child template applied.
  return sceneNodes.map((node) => {
    if (!node.componentId || !node.componentId.startsWith(`${cmp.id}#`)) return node;
    const idx = parseInt(node.componentId.split("#")[1] ?? "-1", 10);
    const tmpl = cmp.nodes[idx];
    if (!tmpl) return node;

    const overrides = node.instanceOverrides ?? [];
    const has = (k: string) => overrides.includes(k as any);

    // Apply template, preserve overridden props.
    const nextStyle = { ...node.style };
    for (const [k, v] of Object.entries(tmpl.style)) {
      if (!has(`style.${k}`)) (nextStyle as any)[k] = v;
    }

    return {
      ...node,
      // Layout: keep position (instance is wherever it was placed).
      // Size + content cascade unless overridden.
      size: has("size") ? node.size : { ...tmpl.size },
      type: has("type") ? node.type : tmpl.type,
      content: has("content") ? node.content : tmpl.content,
      textStyle: has("textStyle") ? node.textStyle : tmpl.textStyle,
      tokenRefs: tmpl.tokenRefs ?? node.tokenRefs,
      style: nextStyle,
    };
  });
};

/** Convenience: mark a node-level prop or style.* prop as user-overridden. */
export const addInstanceOverride = (
  node: CanvasNode,
  key: string,
): CanvasNode => {
  const list = node.instanceOverrides ?? [];
  if (list.includes(key as any)) return node;
  return { ...node, instanceOverrides: [...list, key as any] };
};
