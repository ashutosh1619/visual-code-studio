import { useCallback, useMemo, useState } from "react";
import { Toolbar, type Mode } from "@/components/devcanvas/Toolbar";
import { ElementsPanel } from "@/components/devcanvas/ElementsPanel";
import { Canvas } from "@/components/devcanvas/Canvas";
import { InspectorPanel } from "@/components/devcanvas/InspectorPanel";
import { BottomBar } from "@/components/devcanvas/BottomBar";
import { ProvidersDialog } from "@/components/devcanvas/ProvidersDialog";
import { CodePreviewDialog } from "@/components/devcanvas/CodePreviewDialog";
import {
  type CanvasNode,
  type NodeType,
  defaultContentFor,
  defaultSizeFor,
  defaultStyleFor,
} from "@/lib/scene";
import { generateCode } from "@/lib/codegen";
import { toast } from "sonner";

const uid = () => `n_${Math.random().toString(36).slice(2, 8)}`;

const seedScene = (): CanvasNode[] => [
  {
    id: uid(),
    type: "box",
    position: { x: 160, y: 120 },
    size: { width: 420, height: 280 },
    style: { ...defaultStyleFor("box"), background: "#16130f", borderColor: "#2a2520" },
    zIndex: 1,
  },
  {
    id: uid(),
    type: "text",
    position: { x: 192, y: 156 },
    size: { width: 360, height: 36 },
    style: { ...defaultStyleFor("text"), fontSize: 22, fontWeight: 500, color: "#f3ecdc" },
    content: "Welcome back",
    zIndex: 2,
  },
  {
    id: uid(),
    type: "text",
    position: { x: 192, y: 196 },
    size: { width: 360, height: 22 },
    style: { ...defaultStyleFor("text"), fontSize: 13, color: "#9b9588" },
    content: "Sign in to your DevCanvas workspace",
    zIndex: 3,
  },
  {
    id: uid(),
    type: "input",
    position: { x: 192, y: 246 },
    size: { width: 356, height: 40 },
    style: defaultStyleFor("input"),
    content: "you@studio.com",
    zIndex: 4,
  },
  {
    id: uid(),
    type: "button",
    position: { x: 192, y: 304 },
    size: { width: 356, height: 44 },
    style: defaultStyleFor("button"),
    content: "Continue",
    zIndex: 5,
  },
];

const Index = () => {
  const [nodes, setNodes] = useState<CanvasNode[]>(seedScene);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("design");
  const [zoom, setZoom] = useState(1);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedIds[0]) ?? null,
    [nodes, selectedIds]
  );

  const addNode = useCallback((type: NodeType, x = 200, y = 200) => {
    const node: CanvasNode = {
      id: uid(),
      type,
      position: { x, y },
      size: defaultSizeFor(type),
      style: defaultStyleFor(type),
      content: defaultContentFor(type),
      zIndex: Date.now() % 1_000_000,
    };
    setNodes((n) => [...n, node]);
    setSelectedIds([node.id]);
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<CanvasNode>) => {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const updateStyle = useCallback((id: string, patch: Partial<CanvasNode["style"]>) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, style: { ...n.style, ...patch } } : n))
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

  const handleGenerate = () => {
    const code = generateCode(nodes);
    setGeneratedCode(code);
    setCodeOpen(true);
  };

  const handlePromptToScene = () => {
    if (!prompt.trim()) return;
    // Lightweight prompt → scene heuristic so the demo feels responsive.
    const lower = prompt.toLowerCase();
    const additions: NodeType[] = [];
    if (lower.includes("button")) additions.push("button");
    if (lower.includes("input") || lower.includes("email") || lower.includes("password")) additions.push("input");
    if (lower.includes("title") || lower.includes("heading")) additions.push("text");
    if (lower.includes("image") || lower.includes("photo")) additions.push("image");
    if (additions.length === 0) additions.push("box", "text");

    let y = 120 + nodes.length * 8;
    additions.forEach((t, i) => addNode(t, 700, y + i * 70));
    toast.success("Scene updated from prompt");
    setPrompt("");
  };

  return (
    <>
      <title>DevCanvas — Agentic Visual IDE</title>
      <meta
        name="description"
        content="DevCanvas is a visual-first development environment that turns designs into structured React + Tailwind code, ready for Copilot to extend."
      />

      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <Toolbar
          prompt={prompt}
          setPrompt={setPrompt}
          mode={mode}
          setMode={setMode}
          onGenerate={handleGenerate}
          onOpenSettings={() => setSettingsOpen(true)}
          onPromptToScene={handlePromptToScene}
        />

        <main className="flex flex-1 overflow-hidden">
          <ElementsPanel onAdd={(t) => addNode(t)} />

          <div className="relative flex-1 overflow-hidden">
            <Canvas
              nodes={nodes}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onUpdate={updateNode}
              onDropElement={(t, x, y) => addNode(t as NodeType, x, y)}
              zoom={zoom}
              onCursor={setCursor}
            />

            {/* Floating editorial caption */}
            <div className="pointer-events-none absolute left-6 top-6 max-w-xs">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Scene · 01</p>
              <h1 className="mt-1 font-display text-3xl leading-tight text-balance text-foreground/80">
                The canvas <em className="text-accent">is</em> the source.
              </h1>
              <p className="mt-2 text-xs text-muted-foreground/80">
                Drag elements from the library. Code is a derivative — Copilot extends it.
              </p>
            </div>
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
