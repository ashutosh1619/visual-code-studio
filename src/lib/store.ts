import { useSyncExternalStore } from "react";
import {
  type Scene,
  type CanvasNode,
  type Page,
  type Edge,
  type ComponentMaster,
  type AssetItem,
  type DesignTokens,
  type PromptHistoryItem,
  defaultTokens,
} from "./scene";

const STORAGE_KEY = "devcanvas.scene.v2";
const HISTORY_LIMIT = 60;

type ScenePatch = Partial<Pick<Scene, "pages" | "nodes" | "edges" | "components" | "assets" | "tokens" | "promptHistory">>;

interface InternalState {
  scene: Scene;
  past: Scene[];
  future: Scene[];
}

const emptyScene = (): Scene => ({
  pages: [],
  nodes: [],
  edges: [],
  components: [],
  assets: [],
  tokens: defaultTokens(),
  promptHistory: [],
});

const load = (): Scene => {
  if (typeof window === "undefined") return emptyScene();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Scene>;
      return { ...emptyScene(), ...parsed };
    }
  } catch {/* noop */}
  return emptyScene();
};

const save = (scene: Scene) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
  } catch {/* quota exceeded - ignore */}
};

let state: InternalState = {
  scene: load(),
  past: [],
  future: [],
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const setState = (next: InternalState) => {
  state = next;
  save(next.scene);
  emit();
};

/** Apply a scene mutation and push the previous scene to history. */
export const commit = (patch: ScenePatch | ((s: Scene) => ScenePatch)) => {
  const resolved = typeof patch === "function" ? patch(state.scene) : patch;
  const nextScene: Scene = { ...state.scene, ...resolved };
  setState({
    scene: nextScene,
    past: [...state.past.slice(-HISTORY_LIMIT), state.scene],
    future: [],
  });
};

/** Apply a scene mutation WITHOUT recording history (use for ephemeral drag updates). */
export const transient = (patch: ScenePatch | ((s: Scene) => ScenePatch)) => {
  const resolved = typeof patch === "function" ? patch(state.scene) : patch;
  setState({ ...state, scene: { ...state.scene, ...resolved } });
};

/** Push the current scene to history without changing it (call before transient drag). */
export const beginHistory = () => {
  setState({ ...state, past: [...state.past.slice(-HISTORY_LIMIT), state.scene], future: [] });
};

export const undo = () => {
  if (state.past.length === 0) return;
  const prev = state.past[state.past.length - 1];
  setState({
    scene: prev,
    past: state.past.slice(0, -1),
    future: [state.scene, ...state.future].slice(0, HISTORY_LIMIT),
  });
};

export const redo = () => {
  if (state.future.length === 0) return;
  const next = state.future[0];
  setState({
    scene: next,
    past: [...state.past, state.scene].slice(-HISTORY_LIMIT),
    future: state.future.slice(1),
  });
};

export const replaceScene = (scene: Scene) => {
  setState({
    scene,
    past: [...state.past.slice(-HISTORY_LIMIT), state.scene],
    future: [],
  });
};

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getScene = () => state.scene;
export const canUndo = () => state.past.length > 0;
export const canRedo = () => state.future.length > 0;

/** React hook — re-renders on scene changes. */
export const useScene = (): Scene =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state.scene,
    () => state.scene,
  );

export const useHistoryState = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ({ canUndo: state.past.length > 0, canRedo: state.future.length > 0 }),
    () => ({ canUndo: false, canRedo: false }),
  );

// ---------- High-level mutators ----------

export const updateNode = (id: string, patch: Partial<CanvasNode>) =>
  commit((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));

export const updateNodeStyle = (id: string, patch: Partial<CanvasNode["style"]>) =>
  commit((s) => ({
    nodes: s.nodes.map((n) => (n.id === id ? { ...n, style: { ...n.style, ...patch } } : n)),
  }));

export const updateNodes = (updater: (n: CanvasNode) => CanvasNode) =>
  commit((s) => ({ nodes: s.nodes.map(updater) }));

export const addNodes = (newNodes: CanvasNode[]) =>
  commit((s) => ({ nodes: [...s.nodes, ...newNodes] }));

export const deleteNodes = (ids: string[]) =>
  commit((s) => ({ nodes: s.nodes.filter((n) => !ids.includes(n.id)) }));

export const addPage = (page: Page) => commit((s) => ({ pages: [...s.pages, page] }));

export const updatePage = (id: string, patch: Partial<Page>) =>
  commit((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

export const deletePage = (id: string) =>
  commit((s) => ({
    pages: s.pages.filter((p) => p.id !== id),
    nodes: s.nodes.filter((n) => n.pageId !== id),
    edges: s.edges.filter((e) => e.fromPageId !== id && e.toPageId !== id),
  }));

export const addEdge = (edge: Edge) => commit((s) => ({ edges: [...s.edges, edge] }));
export const deleteEdge = (id: string) =>
  commit((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));

export const setTokens = (tokens: DesignTokens) => commit({ tokens });

export const addComponent = (c: ComponentMaster) =>
  commit((s) => ({ components: [...s.components, c] }));

export const deleteComponent = (id: string) =>
  commit((s) => ({
    components: s.components.filter((c) => c.id !== id),
    // detach instances
    nodes: s.nodes.map((n) => (n.componentId === id ? { ...n, componentId: undefined } : n)),
  }));

export const addAsset = (a: AssetItem) =>
  commit((s) => ({ assets: [...s.assets, a] }));

export const deleteAsset = (id: string) =>
  commit((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));

export const addPromptHistory = (item: PromptHistoryItem) =>
  commit((s) => ({ promptHistory: [item, ...s.promptHistory].slice(0, 100) }));

export const togglePromptFavorite = (id: string) =>
  commit((s) => ({
    promptHistory: s.promptHistory.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)),
  }));

export const clearPromptHistory = () => commit({ promptHistory: [] });
