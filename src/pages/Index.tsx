import { useCallback, useMemo, useState } from "react";
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
import {
  loadComments,
  saveComments,
  PresenceChannel,
  getOrCreateLocalPeer,
  type Comment,
  type PresencePeer,
} from "@/lib/collab";
import { useEffect } from "react";
import {
  type CanvasNode,
  type NodeType,
  type Page,
  type Edge,
  defaultContentFor,
  defaultSizeFor,
  defaultStyleFor,
  newPage,
} from "@/lib/scene";
import { generateCode } from "@/lib/codegen";
import { generateWireframe } from "@/lib/ai";
import { toast } from "sonner";

const uid = () => `n_${Math.random().toString(36).slice(2, 8)}`;

const seedScene = () => {
  const landing: Page = {
    id: "page_seed_landing",
    name: "Landing",
    position: { x: 160, y: 140 },
    size: { width: 420, height: 720 },
    background: "#0f0d0b",
  };
  const signin: Page = {
    id: "page_seed_signin",
    name: "Sign in",
    position: { x: 660, y: 140 },
    size: { width: 420, height: 720 },
    background: "#0f0d0b",
  };

  const nodes: CanvasNode[] = [
    {
      id: uid(),
      pageId: signin.id,
      type: "text",
      position: { x: 32, y: 56 },
      size: { width: 360, height: 36 },
      style: { ...defaultStyleFor("text"), fontSize: 22, fontWeight: 500, color: "#f3ecdc" },
      content: "Welcome back",
      zIndex: 2,
    },
    {
      id: uid(),
      pageId: signin.id,
      type: "text",
      position: { x: 32, y: 96 },
      size: { width: 360, height: 22 },
      style: { ...defaultStyleFor("text"), fontSize: 13, color: "#9b9588" },
      content: "Sign in to your DevCanvas workspace",
      zIndex: 3,
    },
    {
      id: uid(),
      pageId: signin.id,
      type: "input",
      position: { x: 32, y: 156 },
      size: { width: 356, height: 40 },
      style: defaultStyleFor("input"),
      content: "you@studio.com",
      zIndex: 4,
    },
    {
      id: uid(),
      pageId: signin.id,
      type: "button",
      position: { x: 32, y: 216 },
      size: { width: 356, height: 44 },
      style: defaultStyleFor("button"),
      content: "Continue",
      zIndex: 5,
    },
    {
      id: uid(),
      pageId: landing.id,
      type: "text",
      position: { x: 32, y: 80 },
      size: { width: 360, height: 40 },
      style: { ...defaultStyleFor("text"), fontSize: 26, fontWeight: 500, color: "#f3ecdc" },
      content: "DevCanvas",
      zIndex: 1,
    },
    {
      id: uid(),
      pageId: landing.id,
      type: "text",
      position: { x: 32, y: 130 },
      size: { width: 360, height: 50 },
      style: { ...defaultStyleFor("text"), fontSize: 14, color: "#9b9588" },
      content: "Design first. Generate the rest.",
      zIndex: 2,
    },
    {
      id: uid(),
      pageId: landing.id,
      type: "button",
      position: { x: 32, y: 210 },
      size: { width: 200, height: 44 },
      style: defaultStyleFor("button"),
      content: "Get started",
      zIndex: 3,
    },
  ];

  const edges: Edge[] = [
    { id: "e_seed_1", fromPageId: landing.id, toPageId: signin.id, label: "Get started" },
  ];

  return { pages: [landing, signin], nodes, edges };
};

const Index = () => {
  const initial = useMemo(seedScene, []);
  const [pages, setPages] = useState<Page[]>(initial.pages);
  const [nodes, setNodes] = useState<CanvasNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);

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

  // Track peer count via a lightweight presence subscription so the toolbar
  // can show the avatar pill. The CollabLayer manages its own peer state for
  // rendering cursors; here we only count distinct alive peers.
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
      if (msg.type === "cursor") {
        seen.set(msg.peer.id, Date.now());
        tick();
      } else if (msg.type === "leave") {
        seen.delete(msg.id);
        tick();
      }
    });
    const interval = setInterval(tick, 2000);
    return () => {
      unsub();
      clearInterval(interval);
      ch.close();
    };
  }, []);

  // Persist comments locally
  useEffect(() => {
    saveComments(comments);
  }, [comments]);

  const addComment = useCallback((c: Omit<Comment, "id" | "createdAt">) => {
    setComments((prev) => [
      ...prev,
      { ...c, id: `c_${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() },
    ]);
  }, []);

  const resolveComment = useCallback(
    (id: string) => setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved: true } : c))),
    [],
  );

  const deleteComment = useCallback(
    (id: string) => setComments((prev) => prev.filter((c) => c.id !== id)),
    [],
  );

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedIds[0]) ?? null,
    [nodes, selectedIds],
  );

  const targetPageId = selectedPageId ?? pages[0]?.id;

  const addNode = useCallback(
    (type: NodeType, x = 40, y = 40, pageId?: string) => {
      const pid = pageId ?? targetPageId;
      if (!pid) {
        toast.error("Add a page first");
        return;
      }
      const node: CanvasNode = {
        id: uid(),
        pageId: pid,
        type,
        position: { x, y },
        size: defaultSizeFor(type),
        style: defaultStyleFor(type),
        content: defaultContentFor(type),
        zIndex: Date.now() % 1_000_000,
      };
      setNodes((n) => [...n, node]);
      setSelectedIds([node.id]);
    },
    [targetPageId, pages],
  );

  const updateNode = useCallback((id: string, patch: Partial<CanvasNode>) => {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const updatePage = useCallback((id: string, patch: Partial<Page>) => {
    setPages((pgs) => pgs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const updateStyle = useCallback((id: string, patch: Partial<CanvasNode["style"]>) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, style: { ...n.style, ...patch } } : n)),
    );
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
    setSelectedIds((s) => s.filter((x) => x !== id));
  }, []);

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
    setPages((p) => [...p, page]);
    setSelectedPageId(page.id);
    toast.success(`Added ${page.name}`);
  };

  const handleConnectPages = (fromId: string, toId: string) => {
    const exists = edges.some((e) => e.fromPageId === fromId && e.toPageId === toId);
    if (exists) {
      toast.info("Connection already exists");
      return;
    }
    setEdges((es) => [...es, { id: `e_${Math.random().toString(36).slice(2, 8)}`, fromPageId: fromId, toPageId: toId }]);
    toast.success("Pages connected");
  };

  const handleShowCode = () => {
    const code = generateCode(nodes, pages);
    setGeneratedCode(code);
    setCodeOpen(true);
  };

  const handleGenerateWireframe = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the product you want to design");
      return;
    }
    setGenerating(true);
    try {
      const scene = await generateWireframe(prompt.trim());
      setPages(scene.pages);
      setNodes(scene.nodes);
      setEdges(scene.edges);
      setSelectedIds([]);
      setSelectedPageId(scene.pages[0]?.id ?? null);
      // fit-ish zoom
      const totalWidth = scene.pages.reduce((s, p) => s + p.size.width + 80, 0) + 240;
      const z = Math.max(0.4, Math.min(0.9, 1400 / totalWidth));
      setZoom(z);
      toast.success(`${scene.pages.length} pages · ${scene.edges.length} flows generated`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(msg, { duration: 5000 });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <title>DevCanvas — Agentic Visual IDE</title>
      <meta
        name="description"
        content="DevCanvas turns a brief into a multi-page wireframe with a visual page flow you can edit by hand."
      />

      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <Toolbar
          prompt={prompt}
          setPrompt={setPrompt}
          mode={mode}
          setMode={setMode}
          onGenerateWireframe={handleGenerateWireframe}
          onShowCode={handleShowCode}
          onOpenSettings={() => setSettingsOpen(true)}
          onAddPage={handleAddPage}
          connectMode={connectMode}
          onToggleConnect={() => setConnectMode((c) => !c)}
          commentMode={commentMode}
          onToggleComment={() => setCommentMode((c) => !c)}
          onOpenShare={() => setShareOpen(true)}
          onOpenExport={() => setExportOpen(true)}
          generating={generating}
          peerCount={peerCount}
        />

        <main className="flex flex-1 overflow-hidden">
          <ElementsPanel onAdd={(t) => addNode(t, 40, 40)} />

          <div className="relative flex-1 overflow-hidden">
            <Canvas
              pages={pages}
              nodes={nodes}
              edges={edges}
              selectedIds={selectedIds}
              selectedPageId={selectedPageId}
              onSelect={handleSelect}
              onSelectPage={handleSelectPage}
              onUpdateNode={updateNode}
              onUpdatePage={updatePage}
              onDropElement={(t, x, y, pid) => addNode(t as NodeType, x, y, pid)}
              zoom={zoom}
              onCursor={setCursor}
              connectMode={connectMode}
              onConnectPages={handleConnectPages}
            />

            {/* Floating editorial caption */}
            <div className="pointer-events-none absolute left-6 top-6 max-w-xs">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                Wireframe · Flow
              </p>
              <h1 className="mt-1 font-display text-3xl leading-tight text-balance text-foreground/80">
                The canvas <em className="text-accent">is</em> the source.
              </h1>
              <p className="mt-2 text-xs text-muted-foreground/80">
                Describe the product. We draft pages and connect them. Then drag, edit, and add by hand.
              </p>
            </div>

            {connectMode && (
              <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md border border-accent/60 bg-background/90 px-3 py-1.5 text-[11px] text-accent shadow-sm">
                Connect mode · click source page, then target
              </div>
            )}
          </div>

          <InspectorPanel
            nodes={nodes}
            selected={selected}
            onUpdate={updateNode}
            onUpdateStyle={updateStyle}
            onDelete={deleteNode}
            onSelect={(id) => setSelectedIds([id])}
          />
        </main>

        <BottomBar zoom={zoom} setZoom={setZoom} cursor={cursor} mode={mode} nodeCount={nodes.length} />
      </div>

      <ProvidersDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CodePreviewDialog open={codeOpen} onOpenChange={setCodeOpen} code={generatedCode} />
    </>
  );
};

export default Index;
