import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toolbar, type Mode } from "@/components/devcanvas/Toolbar";
import { ElementsPanel } from "@/components/devcanvas/ElementsPanel";
import { Canvas } from "@/components/devcanvas/Canvas";
import { InspectorPanel } from "@/components/devcanvas/InspectorPanel";
import { BottomBar } from "@/components/devcanvas/BottomBar";
import { ProvidersDialog } from "@/components/devcanvas/ProvidersDialog";
import { CodePreviewDialog } from "@/components/devcanvas/CodePreviewDialog";
import { CollabLayer } from "@/components/devcanvas/CollabLayer";
import { SharePopover } from "@/components/devcanvas/SharePopover";
import { ExportDialog } from "@/components/devcanvas/ExportDialog";
import { AIInlineMenu } from "@/components/devcanvas/AIInlineMenu";
import {
  loadComments,
  saveComments,
  PresenceChannel,
  getOrCreateLocalPeer,
  type Comment,
} from "@/lib/collab";
import {
  type CanvasNode,
  type NodeType,
  type Page,
  type Edge,
  type Fidelity,
  defaultContentFor,
  defaultSizeFor,
  defaultStyleFor,
  newPage,
} from "@/lib/scene";
import { generateCode } from "@/lib/codegen";
import { generateWireframe, regeneratePage, autoFixPage } from "@/lib/ai";
import { tileStoryboard } from "@/lib/storyboard";
import { createDesignSystemPage, buildDesignSystemNodes } from "@/lib/designSystemSheet";
import {
  PRESET_THEMES,
  applyTokensToScene,
  loadTokens,
  saveTokens,
  markOverride,
  type DesignTokens,
} from "@/lib/tokens";
import {
  instantiateComponent,
  loadComponents,
  saveComponents,
  updateMasterFromInstance,
  propagateMasterToInstances,
  type SavedComponent,
} from "@/lib/components";
import { toast } from "sonner";
import { PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose } from "lucide-react";

const uid = () => `n_${Math.random().toString(36).slice(2, 8)}`;

/** Heuristic — turn a free-form brief into a 1-3 word project name for the
 *  Design System sheet header. Strips connective words and Title-Cases. */
const deriveProjectName = (brief: string): string => {
  if (!brief) return "Untitled Project";
  const stop = new Set([
    "a","an","the","for","with","and","or","of","to","in","on","app","application",
    "site","website","platform","system","that","which","build","make","create",
    "design","wireframe","mockup","ui","ux","my","our","i","want","need","please",
  ]);
  const words = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stop.has(w))
    .slice(0, 3);
  if (words.length === 0) return "Untitled Project";
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
};

const seedScene = () => {
  const landing: Page = {
    id: "page_seed_landing", name: "Landing",
    position: { x: 160, y: 140 }, size: { width: 420, height: 720 },
    background: "#0f0d0b",
  };
  const signin: Page = {
    id: "page_seed_signin", name: "Sign in",
    position: { x: 660, y: 140 }, size: { width: 420, height: 720 },
    background: "#0f0d0b",
  };
  const nodes: CanvasNode[] = [
    { id: uid(), pageId: signin.id, type: "text", position: { x: 32, y: 56 }, size: { width: 360, height: 36 }, style: { ...defaultStyleFor("text"), fontSize: 22, fontWeight: 500, color: "#f3ecdc" }, content: "Welcome back", zIndex: 2 },
    { id: uid(), pageId: signin.id, type: "input", position: { x: 32, y: 156 }, size: { width: 356, height: 40 }, style: defaultStyleFor("input"), content: "you@studio.com", zIndex: 4 },
    { id: uid(), pageId: signin.id, type: "button", position: { x: 32, y: 216 }, size: { width: 356, height: 44 }, style: defaultStyleFor("button"), content: "Continue", zIndex: 5 },
    { id: uid(), pageId: landing.id, type: "text", position: { x: 32, y: 80 }, size: { width: 360, height: 40 }, style: { ...defaultStyleFor("text"), fontSize: 26, fontWeight: 500, color: "#f3ecdc" }, content: "DevCanvas", zIndex: 1 },
    { id: uid(), pageId: landing.id, type: "button", position: { x: 32, y: 210 }, size: { width: 200, height: 44 }, style: defaultStyleFor("button"), content: "Get started", zIndex: 3 },
  ];
  const edges: Edge[] = [{ id: "e_seed_1", fromPageId: landing.id, toPageId: signin.id, label: "Get started" }];
  return { pages: [landing, signin], nodes, edges };
};

interface SceneState { pages: Page[]; nodes: CanvasNode[]; edges: Edge[]; }

const Index = () => {
  const initial = useMemo(seedScene, []);
  const [scene, setScene] = useState<SceneState>(initial);
  const { pages, nodes, edges } = scene;

  // Undo/redo: simple snapshot stacks
  const past = useRef<SceneState[]>([]);
  const future = useRef<SceneState[]>([]);

  const commit = useCallback((label: string) => {
    setScene((curr) => {
      const last = past.current[past.current.length - 1];
      if (last && JSON.stringify(last) === JSON.stringify(curr)) return curr;
      past.current.push(structuredClone(curr));
      if (past.current.length > 50) past.current.shift();
      future.current = [];
      return curr;
    });
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    setScene((curr) => {
      const snap = past.current.pop()!;
      future.current.push(structuredClone(curr));
      return snap;
    });
    toast.info("Undo");
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setScene((curr) => {
      const snap = future.current.pop()!;
      past.current.push(structuredClone(curr));
      return snap;
    });
    toast.info("Redo");
  }, []);

  // Selection + UI state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("design");
  const [zoom, setZoom] = useState(0.85);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [connectMode, setConnectMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>(() => loadComments());
  const [peerCount, setPeerCount] = useState(0);
  const [regeneratingPageId, setRegeneratingPageId] = useState<string | null>(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const [layoutPreview, setLayoutPreview] = useState(false);
  const [fidelity, setFidelity] = useState<Fidelity>("wireframe");
  const [includeDesignSystem, setIncludeDesignSystem] = useState(true);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Tokens
  const [{ themeKey, tokens }, setTheme] = useState(() => loadTokens());
  useEffect(() => { saveTokens(themeKey, tokens); }, [themeKey, tokens]);

  // Presence (peer count)
  useEffect(() => {
    const me = getOrCreateLocalPeer();
    const ch = new PresenceChannel("default");
    const seen = new Map<string, number>();
    const tick = () => {
      const cutoff = Date.now() - 5000;
      let live = 0;
      for (const [id, t] of seen) if (id !== me.id && t > cutoff) live++;
      setPeerCount(live);
    };
    const unsub = ch.subscribe((msg) => {
      if (msg.type === "cursor") { seen.set(msg.peer.id, Date.now()); tick(); }
      else if (msg.type === "leave") { seen.delete(msg.id); tick(); }
    });
    const interval = setInterval(tick, 2000);
    return () => { unsub(); clearInterval(interval); ch.close(); };
  }, []);

  useEffect(() => { saveComments(comments); }, [comments]);

  const addComment = useCallback((c: Omit<Comment, "id" | "createdAt">) => {
    setComments((prev) => [...prev, { ...c, id: `c_${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() }]);
  }, []);
  const resolveComment = useCallback((id: string) => setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved: true } : c))), []);
  const deleteComment = useCallback((id: string) => setComments((prev) => prev.filter((c) => c.id !== id)), []);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedIds[0]) ?? null, [nodes, selectedIds]);
  const selectedNodes = useMemo(() => nodes.filter((n) => selectedIds.includes(n.id)), [nodes, selectedIds]);
  const targetPageId = selectedPageId ?? pages[0]?.id;

  const addNode = useCallback((type: NodeType, x = 40, y = 40, pageId?: string) => {
    const pid = pageId ?? targetPageId;
    if (!pid) { toast.error("Add a page first"); return; }
    const node: CanvasNode = {
      id: uid(), pageId: pid, type,
      position: { x, y }, size: defaultSizeFor(type),
      style: defaultStyleFor(type), content: defaultContentFor(type),
      zIndex: Date.now() % 1_000_000,
    };
    setScene((s) => ({ ...s, nodes: [...s.nodes, node] }));
    setSelectedIds([node.id]);
    commit("Add element");
  }, [targetPageId, commit]);

  const updateNode = useCallback((id: string, patch: Partial<CanvasNode>) => {
    setScene((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  }, []);

  const updateNodes = useCallback((updates: { id: string; patch: Partial<CanvasNode> }[]) => {
    setScene((s) => {
      const map = new Map(updates.map((u) => [u.id, u.patch] as const));
      return { ...s, nodes: s.nodes.map((n) => (map.has(n.id) ? { ...n, ...map.get(n.id) } : n)) };
    });
  }, []);

  const updatePage = useCallback((id: string, patch: Partial<Page>) => {
    setScene((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);

  const updateStyle = useCallback((id: string, patch: Partial<CanvasNode["style"]>) => {
    setScene((s) => ({
      ...s,
      nodes: s.nodes.map((n) => {
        if (n.id !== id) return n;
        // Mark each touched style prop as overridden so theme switches and
        // master-component cascades won't clobber the user's manual choice.
        let next: CanvasNode = { ...n, style: { ...n.style, ...patch } };
        for (const k of Object.keys(patch)) {
          next = markOverride(next, k as keyof CanvasNode["style"]);
        }
        return next;
      }),
    }));
  }, []);

  // ---------- Master / instance propagation ----------
  // When the user edits a node that is part of a saved component, we offer to
  // push those edits up to the master + cascade to every instance.
  const propagateFromInstance = useCallback((node: CanvasNode) => {
    if (!node.componentId) return;
    const masterId = node.componentId.split("#")[0];
    const list = loadComponents();
    const master = list.find((c) => c.id === masterId);
    if (!master) return;
    // Collect all instance children (same instance group on this page).
    const sameInstance = scene.nodes.filter(
      (m) => m.componentId?.startsWith(`${masterId}#`) && m.pageId === node.pageId,
    );
    if (sameInstance.length === 0) return;
    const updated = updateMasterFromInstance(master, sameInstance);
    const nextList = list.map((c) => (c.id === masterId ? updated : c));
    saveComponents(nextList);
    const cascaded = propagateMasterToInstances(updated, scene.nodes);
    setScene((s) => ({ ...s, nodes: cascaded }));
    commit(`Update master · ${updated.name}`);
    toast.success(`Pushed to ${updated.name} · v${updated.version}`);
  }, [scene.nodes, commit]);

  const deleteNode = useCallback((id: string) => {
    setScene((s) => ({ ...s, nodes: s.nodes.filter((n) => n.id !== id) }));
    setSelectedIds((s) => s.filter((x) => x !== id));
    commit("Delete element");
  }, [commit]);

  const handleSelect = useCallback((id: string | null, additive?: boolean) => {
    if (id === null) return setSelectedIds([]);
    setSelectedIds((s) => (additive ? Array.from(new Set([...s, id])) : [id]));
  }, []);

  const handleSelectPage = useCallback((id: string | null) => {
    setSelectedPageId(id);
    if (id) setSelectedIds([]);
  }, []);

  const handleAddPage = () => {
    const lastX = pages.reduce((max, p) => Math.max(max, p.position.x + p.size.width), 0);
    const page = newPage(`Page ${pages.length + 1}`, lastX + 80, 140);
    setScene((s) => ({ ...s, pages: [...s.pages, page] }));
    setSelectedPageId(page.id);
    commit("Add page");
    toast.success(`Added ${page.name}`);
  };

  const handleConnectPages = (fromId: string, toId: string) => {
    if (edges.some((e) => e.fromPageId === fromId && e.toPageId === toId)) {
      toast.info("Connection already exists"); return;
    }
    setScene((s) => ({ ...s, edges: [...s.edges, { id: `e_${Math.random().toString(36).slice(2, 8)}`, fromPageId: fromId, toPageId: toId }] }));
    commit("Connect pages");
    toast.success("Pages connected");
  };

  const handleShowCode = () => {
    setGeneratedCode(generateCode(nodes, pages));
    setCodeOpen(true);
  };

  const handleGenerateWireframe = async () => {
    if (!prompt.trim()) { toast.error("Describe the product you want to design"); return; }
    setGenerating(true);
    try {
      const result = await generateWireframe(prompt.trim(), fidelity);
      // Optionally prepend a design-system sheet (Page 0).
      let pagesOut: Page[] = result.pages;
      let nodesOut: CanvasNode[] = result.nodes;
      if (includeDesignSystem) {
        const dsPage = createDesignSystemPage();
        const projectName = deriveProjectName(prompt.trim());
        const dsNodes = buildDesignSystemNodes(dsPage, tokens, fidelity, projectName);
        pagesOut = [dsPage, ...pagesOut];
        nodesOut = [...dsNodes, ...nodesOut];
      }
      // Tile every page into a storyboard grid (rows of 4).
      pagesOut = tileStoryboard(pagesOut, { cols: 4 });
      // Apply tokens (only if hi-fi; for wireframe keep monochrome look).
      const themed = fidelity === "hifi"
        ? applyTokensToScene({ pages: pagesOut, nodes: nodesOut }, tokens)
        : { pages: pagesOut, nodes: nodesOut };
      setScene({ pages: themed.pages, nodes: themed.nodes, edges: result.edges });
      setSelectedIds([]);
      setSelectedPageId(themed.pages[0]?.id ?? null);
      // Zoom to fit the storyboard width.
      const maxX = Math.max(...themed.pages.map((p) => p.position.x + p.size.width));
      const minX = Math.min(...themed.pages.map((p) => p.position.x));
      setZoom(Math.max(0.18, Math.min(0.7, (window.innerWidth - 600) / (maxX - minX + 240))));
      commit("Generate wireframe");
      toast.success(`${themed.pages.length} pages · ${result.edges.length} flows generated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed", { duration: 5000 });
    } finally { setGenerating(false); }
  };

  const handleTileStoryboard = () => {
    if (pages.length === 0) {
      toast.info("Nothing to tile yet");
      return;
    }
    const tiled = tileStoryboard(pages, { cols: 4 });
    setScene((s) => ({ ...s, pages: tiled }));
    commit("Tile storyboard");
    toast.success("Pages tiled");
  };

  const handleRegeneratePage = async (pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    setRegeneratingPageId(pageId);
    try {
      const brief = prompt.trim() || `Redesign the "${page.name}" page`;
      const result = await regeneratePage(page.name, brief, pageId, fidelity);
      const themed = fidelity === "hifi"
        ? applyTokensToScene({ pages: [page], nodes: result.nodes }, tokens)
        : { pages: [page], nodes: result.nodes };
      setScene((s) => ({ ...s, nodes: [...s.nodes.filter((n) => n.pageId !== pageId), ...themed.nodes] }));
      commit(`Regenerate ${page.name}`);
      toast.success(`Regenerated ${page.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally { setRegeneratingPageId(null); }
  };

  // ---------- Vision-grounded auto-fix across every page ----------
  const handleAutoFix = async () => {
    if (pages.length === 0) {
      toast.error("Nothing to fix yet");
      return;
    }
    setAutoFixing(true);
    let totalFixes = 0;
    try {
      const updatesById = new Map<string, Partial<CanvasNode>>();
      for (const page of pages) {
        const pageNodes = nodes.filter((n) => n.pageId === page.id);
        if (pageNodes.length === 0) continue;
        try {
          const fixes = await autoFixPage(page, pageNodes);
          for (const f of fixes) {
            const orig = pageNodes.find((n) => n.id === f.id);
            if (!orig) continue;
            const merged: Partial<CanvasNode> = { ...(updatesById.get(f.id) ?? {}) };
            if (f.patch.position) merged.position = f.patch.position;
            if (f.patch.size) merged.size = f.patch.size;
            if (typeof f.patch.content === "string") merged.content = f.patch.content;
            if (f.patch.style) {
              merged.style = { ...orig.style, ...(merged.style ?? {}), ...f.patch.style };
            }
            updatesById.set(f.id, merged);
            totalFixes++;
          }
        } catch (e) {
          // continue with the next page; surface a single warning at the end
          console.warn("auto-fix page failed", page.name, e);
        }
      }
      if (updatesById.size === 0) {
        toast.info("Nothing to fix — looks good!");
      } else {
        setScene((s) => ({
          ...s,
          nodes: s.nodes.map((n) => (updatesById.has(n.id) ? { ...n, ...updatesById.get(n.id) } : n)),
        }));
        commit("AI auto-fix");
        toast.success(`Auto-fix · ${totalFixes} adjustment${totalFixes === 1 ? "" : "s"} applied`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-fix failed");
    } finally {
      setAutoFixing(false);
    }
  };

  // Tokens application
  const applyPreset = (key: string) => {
    const preset = PRESET_THEMES[key];
    if (!preset) return;
    const themed = applyTokensToScene({ pages, nodes }, preset.tokens);
    setScene((s) => ({ ...s, pages: themed.pages, nodes: themed.nodes }));
    setTheme({ themeKey: key, tokens: preset.tokens });
    commit(`Apply ${preset.name} theme`);
  };

  const updateTokens = (next: DesignTokens) => {
    const themed = applyTokensToScene({ pages, nodes }, next);
    setScene((s) => ({ ...s, pages: themed.pages, nodes: themed.nodes }));
    setTheme({ themeKey: "custom", tokens: next });
  };

  // Components
  const insertComponent = (cmp: SavedComponent) => {
    const pid = targetPageId;
    if (!pid) { toast.error("Select a page first"); return; }
    const newNodes = instantiateComponent(cmp, pid, { x: 40, y: 40 }, Date.now() % 1_000_000);
    setScene((s) => ({ ...s, nodes: [...s.nodes, ...newNodes] }));
    setSelectedIds(newNodes.map((n) => n.id));
    commit(`Insert ${cmp.name}`);
    toast.success(`Inserted ${cmp.name}`);
  };

  // AI inline edit anchor (top-right of selected node, in screen coords inside canvas)
  const aiAnchor = useMemo(() => {
    if (!selected) return null;
    const page = pages.find((p) => p.id === selected.pageId);
    if (!page) return null;
    return {
      x: (page.position.x + selected.position.x + selected.size.width) * zoom,
      y: (page.position.y + selected.position.y) * zoom,
    };
  }, [selected, pages, zoom]);

  const applyInlineEdit = (patch: Partial<CanvasNode> & { style?: Partial<CanvasNode["style"]> }) => {
    if (!selected) return;
    const { style, ...rest } = patch;
    setScene((s) => ({
      ...s,
      nodes: s.nodes.map((n) =>
        n.id === selected.id ? { ...n, ...rest, style: { ...n.style, ...(style ?? {}) } } : n,
      ),
    }));
    commit("AI edit");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); return; }
      if (inField) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        setScene((s) => ({ ...s, nodes: s.nodes.filter((n) => !selectedIds.includes(n.id)) }));
        setSelectedIds([]);
        commit("Delete");
      }
      if (meta && e.key.toLowerCase() === "d" && selected) {
        e.preventDefault();
        const dup: CanvasNode = { ...selected, id: uid(), position: { x: selected.position.x + 12, y: selected.position.y + 12 }, zIndex: Date.now() % 1_000_000 };
        setScene((s) => ({ ...s, nodes: [...s.nodes, dup] }));
        setSelectedIds([dup.id]);
        commit("Duplicate");
      }
      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(nodes.map((n) => n.id));
      }
      if (e.key === "Escape") setSelectedIds([]);
      if (e.key === "0" && meta) { e.preventDefault(); setZoom(1); }
      if (e.key === "1" && meta) {
        // zoom-to-fit
        e.preventDefault();
        if (pages.length === 0) return;
        const minX = Math.min(...pages.map((p) => p.position.x)) - 80;
        const maxX = Math.max(...pages.map((p) => p.position.x + p.size.width)) + 80;
        setZoom(Math.max(0.2, Math.min(1.5, (window.innerWidth - 600) / (maxX - minX))));
      }
      // Arrow nudge
      if (selectedIds.length && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setScene((s) => ({
          ...s,
          nodes: s.nodes.map((n) =>
            selectedIds.includes(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n,
          ),
        }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedIds, selected, nodes, pages, commit]);

  return (
    <>
      <title>DevCanvas — Agentic Visual IDE</title>
      <meta name="description" content="DevCanvas turns a brief into a multi-page wireframe with a visual page flow you can edit by hand." />

      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <Toolbar
          prompt={prompt} setPrompt={setPrompt}
          mode={mode} setMode={setMode}
          onGenerateWireframe={handleGenerateWireframe}
          onShowCode={handleShowCode}
          onOpenSettings={() => setSettingsOpen(true)}
          onAddPage={handleAddPage}
          connectMode={connectMode} onToggleConnect={() => setConnectMode((c) => !c)}
          commentMode={commentMode} onToggleComment={() => setCommentMode((c) => !c)}
          onOpenShare={() => setShareOpen(true)}
          onOpenExport={() => setExportOpen(true)}
          onAutoFix={handleAutoFix}
          autoFixing={autoFixing}
          generating={generating} peerCount={peerCount}
          layoutPreview={layoutPreview}
          onToggleLayoutPreview={() => setLayoutPreview((v) => !v)}
          fidelity={fidelity}
          onToggleFidelity={() => setFidelity((f) => (f === "wireframe" ? "hifi" : "wireframe"))}
          includeDesignSystem={includeDesignSystem}
          onToggleDesignSystem={() => setIncludeDesignSystem((v) => !v)}
          onTileStoryboard={handleTileStoryboard}
        />

        <main className="flex flex-1 overflow-hidden">
          {leftCollapsed ? (
            <button
              onClick={() => setLeftCollapsed(false)}
              className="group flex h-full w-7 flex-col items-center justify-center gap-2 border-r hairline panel-surface text-muted-foreground transition-colors hover:text-foreground"
              title="Expand library panel"
              aria-label="Expand library panel"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span className="rotate-180 text-[9px] uppercase tracking-[0.2em] [writing-mode:vertical-rl]">
                Library
              </span>
            </button>
          ) : (
            <div className="relative flex h-full">
              <ElementsPanel
                onAdd={(t) => addNode(t, 40, 40)}
                selectedNodes={selectedNodes}
                onInsertComponent={insertComponent}
                themeKey={themeKey}
                tokens={tokens}
                onApplyPreset={applyPreset}
                onUpdateTokens={updateTokens}
              />
              <button
                onClick={() => setLeftCollapsed(true)}
                className="absolute right-0 top-3 z-10 flex h-6 w-6 -translate-x-1 items-center justify-center rounded-md border hairline bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                title="Collapse library panel"
                aria-label="Collapse library panel"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="relative flex-1 overflow-hidden">
            <Canvas
              pages={pages} nodes={nodes} edges={edges}
              selectedIds={selectedIds} selectedPageId={selectedPageId}
              onSelect={handleSelect}
              onSelectMany={(ids) => setSelectedIds(ids)}
              onSelectPage={handleSelectPage}
              onUpdateNode={updateNode}
              onUpdateNodes={updateNodes}
              onUpdatePage={updatePage}
              onDropElement={(t, x, y, pid) => addNode(t as NodeType, x, y, pid)}
              onCommit={commit}
              zoom={zoom}
              onCursor={setCursor}
              connectMode={connectMode}
              onConnectPages={handleConnectPages}
              onRegeneratePage={handleRegeneratePage}
              regeneratingPageId={regeneratingPageId}
              layoutPreview={layoutPreview}
            />

            <CollabLayer
              roomId="default" zoom={zoom} cursor={cursor} pages={pages}
              comments={comments} commentMode={commentMode}
              onAddComment={addComment} onResolveComment={resolveComment} onDeleteComment={deleteComment}
            />

            <AIInlineMenu node={selected} anchor={aiAnchor} onApply={applyInlineEdit} />

            <div className="pointer-events-none absolute left-6 top-6 max-w-xs">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Wireframe · Flow</p>
              <h1 className="mt-1 font-display text-3xl leading-tight text-balance text-foreground/80">
                The canvas <em className="text-accent">is</em> the source.
              </h1>
              <p className="mt-2 text-xs text-muted-foreground/80">
                Describe any product. We draft pages and connect them. Then drag, edit, and add by hand.
              </p>
            </div>

            {(connectMode || commentMode) && (
              <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md border border-accent/60 bg-background/90 px-3 py-1.5 text-[11px] text-accent shadow-sm">
                {connectMode ? "Connect mode · click source page, then target" : "Comment mode · click on a page to leave a note"}
              </div>
            )}
          </div>

          {rightCollapsed ? (
            <button
              onClick={() => setRightCollapsed(false)}
              className="group flex h-full w-7 flex-col items-center justify-center gap-2 border-l hairline panel-surface text-muted-foreground transition-colors hover:text-foreground"
              title="Expand inspector panel"
              aria-label="Expand inspector panel"
            >
              <PanelRightOpen className="h-4 w-4" />
              <span className="text-[9px] uppercase tracking-[0.2em] [writing-mode:vertical-rl]">
                Inspector
              </span>
            </button>
          ) : (
            <div className="relative flex h-full">
              <button
                onClick={() => setRightCollapsed(true)}
                className="absolute left-0 top-3 z-10 flex h-6 w-6 translate-x-1 items-center justify-center rounded-md border hairline bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                title="Collapse inspector panel"
                aria-label="Collapse inspector panel"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
              <InspectorPanel
                nodes={nodes} selected={selected}
                onUpdate={updateNode} onUpdateStyle={updateStyle}
                onDelete={deleteNode}
                onSelect={(id) => setSelectedIds([id])}
                onPushToMaster={selected?.componentId ? () => propagateFromInstance(selected) : undefined}
              />
            </div>
          )}
        </main>

        <BottomBar zoom={zoom} setZoom={setZoom} cursor={cursor} mode={mode} nodeCount={nodes.length} />
      </div>

      <ProvidersDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CodePreviewDialog open={codeOpen} onOpenChange={setCodeOpen} code={generatedCode} />
      <SharePopover open={shareOpen} onOpenChange={setShareOpen} peerCount={peerCount} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} pages={pages} nodes={nodes} edges={edges} />
    </>
  );
};

export default Index;
