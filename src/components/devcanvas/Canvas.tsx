import { useEffect, useRef, useState } from "react";
import type { CanvasNode, Page, Edge } from "@/lib/scene";
import { snapRect, type Guide } from "@/lib/snap";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  pages: Page[];
  nodes: CanvasNode[];
  edges: Edge[];
  selectedIds: string[];
  selectedPageId: string | null;
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectMany: (ids: string[]) => void;
  onSelectPage: (id: string | null) => void;
  onUpdateNode: (id: string, patch: Partial<CanvasNode>) => void;
  onUpdateNodes: (updates: { id: string; patch: Partial<CanvasNode> }[]) => void;
  onUpdatePage: (id: string, patch: Partial<Page>) => void;
  onDropElement: (type: string, x: number, y: number, pageId: string) => void;
  /** Called once a drag/resize finishes so the parent can commit a history snapshot */
  onCommit: (label: string) => void;
  zoom: number;
  onCursor: (p: { x: number; y: number }) => void;
  connectMode: boolean;
  onConnectPages: (fromId: string, toId: string) => void;
  /** Open the AI inline menu for the page (regenerate). */
  onRegeneratePage: (pageId: string) => void;
  regeneratingPageId: string | null;
}

type DragState =
  | {
      kind: "move-nodes";
      ids: string[];
      startX: number;
      startY: number;
      origs: Record<string, { x: number; y: number }>;
    }
  | {
      kind: "resize-node";
      id: string;
      handle: "br" | "tr" | "bl" | "tl";
      startX: number;
      startY: number;
      orig: CanvasNode;
    }
  | {
      kind: "move-page";
      id: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    }
  | {
      kind: "marquee";
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    }
  | null;

export const Canvas = ({
  pages,
  nodes,
  edges,
  selectedIds,
  selectedPageId,
  onSelect,
  onSelectMany,
  onSelectPage,
  onUpdateNode,
  onUpdateNodes,
  onUpdatePage,
  onDropElement,
  onCommit,
  zoom,
  onCursor,
  connectMode,
  onConnectPages,
  onRegeneratePage,
  regeneratingPageId,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  const pageById = new Map(pages.map((p) => [p.id, p]));

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;

      if (drag.kind === "move-nodes") {
        // Compute snap based on the FIRST moving node, then translate the
        // group by the snapped delta. Snap targets are nodes on the same
        // page that are NOT being dragged.
        const primaryId = drag.ids[0];
        const primary = nodes.find((n) => n.id === primaryId);
        if (!primary) return;
        const page = pageById.get(primary.pageId);
        if (!page) return;

        const proposedAbs = {
          id: primary.id,
          x: page.position.x + drag.origs[primary.id].x + dx,
          y: page.position.y + drag.origs[primary.id].y + dy,
          w: primary.size.width,
          h: primary.size.height,
        };
        const others = nodes
          .filter((n) => n.pageId === primary.pageId && !drag.ids.includes(n.id))
          .map((n) => ({
            id: n.id,
            x: page.position.x + n.position.x,
            y: page.position.y + n.position.y,
            w: n.size.width,
            h: n.size.height,
          }));

        const snap = snapRect(proposedAbs, others);
        setGuides(snap.guides);

        const updates = drag.ids.map((id) => {
          const orig = drag.origs[id];
          return {
            id,
            patch: {
              position: { x: orig.x + dx + snap.dx, y: orig.y + dy + snap.dy },
            },
          };
        });
        onUpdateNodes(updates);
      } else if (drag.kind === "move-page") {
        onUpdatePage(drag.id, { position: { x: drag.origX + dx, y: drag.origY + dy } });
      } else if (drag.kind === "resize-node") {
        const o = drag.orig;
        let { x, y } = o.position;
        let w = o.size.width;
        let h = o.size.height;
        if (drag.handle.includes("r")) w = Math.max(20, o.size.width + dx);
        if (drag.handle.includes("b")) h = Math.max(20, o.size.height + dy);
        if (drag.handle.includes("l")) {
          w = Math.max(20, o.size.width - dx);
          x = o.position.x + dx;
        }
        if (drag.handle.includes("t")) {
          h = Math.max(20, o.size.height - dy);
          y = o.position.y + dy;
        }
        onUpdateNode(drag.id, { position: { x, y }, size: { width: w, height: h } });
      } else if (drag.kind === "marquee") {
        setDrag({ ...drag, currentX: e.clientX, currentY: e.clientY });
      }
    };
    const onUp = () => {
      if (drag.kind === "marquee" && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const x1 = (Math.min(drag.startX, drag.currentX) - rect.left) / zoom;
        const y1 = (Math.min(drag.startY, drag.currentY) - rect.top) / zoom;
        const x2 = (Math.max(drag.startX, drag.currentX) - rect.left) / zoom;
        const y2 = (Math.max(drag.startY, drag.currentY) - rect.top) / zoom;
        const hits: string[] = [];
        for (const n of nodes) {
          const page = pageById.get(n.pageId);
          if (!page) continue;
          const ax = page.position.x + n.position.x;
          const ay = page.position.y + n.position.y;
          const bx = ax + n.size.width;
          const by = ay + n.size.height;
          if (ax < x2 && bx > x1 && ay < y2 && by > y1) hits.push(n.id);
        }
        if (hits.length) onSelectMany(hits);
        else onSelect(null);
      } else if (drag.kind === "move-nodes") {
        onCommit(drag.ids.length > 1 ? "Move group" : "Move element");
      } else if (drag.kind === "resize-node") {
        onCommit("Resize element");
      } else if (drag.kind === "move-page") {
        onCommit("Move page");
      }
      setDrag(null);
      setGuides([]);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, nodes, onUpdateNode, onUpdateNodes, onUpdatePage, onSelectMany, onSelect, onCommit, zoom, pageById]);

  // Reset connect-from when connect mode toggled off
  useEffect(() => {
    if (!connectMode) setConnectFrom(null);
  }, [connectMode]);

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onCursor({
      x: Math.round((e.clientX - rect.left) / zoom),
      y: Math.round((e.clientY - rect.top) / zoom),
    });
  };

  const handlePageClick = (pageId: string) => {
    if (!connectMode) {
      onSelectPage(pageId);
      return;
    }
    if (!connectFrom) {
      setConnectFrom(pageId);
    } else if (connectFrom !== pageId) {
      onConnectPages(connectFrom, pageId);
      setConnectFrom(null);
    }
  };

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-auto bg-canvas canvas-grid"
      onMouseMove={handleMove}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.button !== 0) return;
        // Begin marquee select on empty-canvas drag
        setDrag({
          kind: "marquee",
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        });
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelect(null);
          onSelectPage(null);
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData("devcanvas/type");
        if (!type || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        const target =
          pages.find(
            (p) =>
              x >= p.position.x &&
              x <= p.position.x + p.size.width &&
              y >= p.position.y &&
              y <= p.position.y + p.size.height,
          ) ?? pages[0];
        if (!target) return;
        onDropElement(type, x - target.position.x, y - target.position.y, target.id);
      }}
    >
      <div
        className="relative"
        style={{
          width: 8000,
          height: 5000,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Edges layer */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={8000}
          height={5000}
          style={{ overflow: "visible" }}
        >
          <defs>
            <marker
              id="dc-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--accent))" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = pageById.get(e.fromPageId);
            const b = pageById.get(e.toPageId);
            if (!a || !b) return null;
            const ax = a.position.x + a.size.width;
            const ay = a.position.y + a.size.height / 2;
            const bx = b.position.x;
            const by = b.position.y + b.size.height / 2;
            const midX = (ax + bx) / 2;
            const d = `M ${ax} ${ay} C ${midX} ${ay}, ${midX} ${by}, ${bx} ${by}`;
            return (
              <g key={e.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                  markerEnd="url(#dc-arrow)"
                />
                {e.label && (
                  <text
                    x={midX}
                    y={(ay + by) / 2 - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    style={{ fontSize: 11, fontFamily: "ui-sans-serif" }}
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Snap guides */}
          {guides.map((g, i) =>
            g.axis === "x" ? (
              <line
                key={i}
                x1={g.position}
                y1={g.start - 12}
                x2={g.position}
                y2={g.end + 12}
                stroke="hsl(var(--accent))"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.9}
              />
            ) : (
              <line
                key={i}
                x1={g.start - 12}
                y1={g.position}
                x2={g.end + 12}
                y2={g.position}
                stroke="hsl(var(--accent))"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.9}
              />
            ),
          )}

          {connectMode && connectFrom && (() => {
            const a = pageById.get(connectFrom);
            if (!a) return null;
            return (
              <circle
                cx={a.position.x + a.size.width}
                cy={a.position.y + a.size.height / 2}
                r={6}
                fill="hsl(var(--accent))"
              />
            );
          })()}
        </svg>

        {/* Pages */}
        {pages.map((page) => {
          const isSelected = selectedPageId === page.id;
          const isConnectSource = connectMode && connectFrom === page.id;
          const isRegenerating = regeneratingPageId === page.id;
          return (
            <div
              key={page.id}
              className={cn(
                "absolute group/page",
                connectMode && "cursor-crosshair",
              )}
              style={{
                left: page.position.x,
                top: page.position.y,
                width: page.size.width,
                height: page.size.height,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handlePageClick(page.id);
              }}
            >
              <div
                className="absolute -top-7 left-0 flex cursor-move items-center gap-2 text-[11px]"
                onMouseDown={(e) => {
                  if (connectMode) return;
                  e.stopPropagation();
                  onSelectPage(page.id);
                  setDrag({
                    kind: "move-page",
                    id: page.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: page.position.x,
                    origY: page.position.y,
                  });
                }}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isConnectSource ? "bg-accent" : isSelected ? "bg-accent" : "bg-muted-foreground/40",
                  )}
                />
                <span
                  className={cn(
                    "font-display tracking-wide",
                    isSelected ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {page.name}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/40">
                  {page.size.width}×{page.size.height}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isRegenerating) onRegeneratePage(page.id);
                  }}
                  className={cn(
                    "ml-1 rounded p-0.5 opacity-0 transition-opacity group-hover/page:opacity-100",
                    isSelected && "opacity-100",
                    "text-muted-foreground hover:text-accent",
                  )}
                  title="Regenerate this page with AI"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {isRegenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </button>
              </div>

              <div
                className={cn(
                  "h-full w-full overflow-hidden rounded-md transition-all",
                  isSelected
                    ? "ring-2 ring-accent/70"
                    : isConnectSource
                    ? "ring-2 ring-accent"
                    : "ring-1 ring-hairline",
                )}
                style={{ background: page.background }}
              />
            </div>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const page = pageById.get(n.pageId);
          if (!page) return null;
          const selected = selectedIds.includes(n.id);
          const absX = page.position.x + n.position.x;
          const absY = page.position.y + n.position.y;
          return (
            <div
              key={n.id}
              onMouseDown={(e) => {
                if (connectMode) return;
                e.stopPropagation();
                // If clicking a non-selected node without shift, isolate it.
                // If shift, toggle into selection.
                let nextIds: string[];
                if (e.shiftKey) {
                  nextIds = selectedIds.includes(n.id)
                    ? selectedIds.filter((id) => id !== n.id)
                    : [...selectedIds, n.id];
                  onSelect(n.id, true);
                } else {
                  nextIds = selected ? selectedIds : [n.id];
                  if (!selected) onSelect(n.id, false);
                }
                if (nextIds.length === 0) return;
                const origs: Record<string, { x: number; y: number }> = {};
                for (const id of nextIds) {
                  const target = nodes.find((m) => m.id === id);
                  if (target) origs[id] = { ...target.position };
                }
                setDrag({
                  kind: "move-nodes",
                  ids: nextIds,
                  startX: e.clientX,
                  startY: e.clientY,
                  origs,
                });
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "absolute cursor-move group transition-shadow",
                selected && "ring-2 ring-accent ring-offset-0",
              )}
              style={{
                left: absX,
                top: absY,
                width: n.size.width,
                height: n.size.height,
                zIndex: n.zIndex,
                background: n.style.background,
                color: n.style.color,
                borderRadius: n.style.borderRadius,
                border: n.style.borderWidth
                  ? `${n.style.borderWidth}px solid ${n.style.borderColor ?? "#000"}`
                  : undefined,
                padding: n.style.padding,
                fontSize: n.style.fontSize,
                fontWeight: n.style.fontWeight,
                display: n.style.display,
                flexDirection: n.style.flexDirection,
                alignItems:
                  n.style.alignItems === "start"
                    ? "flex-start"
                    : n.style.alignItems === "end"
                    ? "flex-end"
                    : n.style.alignItems,
                justifyContent:
                  n.style.justifyContent === "start"
                    ? "flex-start"
                    : n.style.justifyContent === "end"
                    ? "flex-end"
                    : n.style.justifyContent === "between"
                    ? "space-between"
                    : n.style.justifyContent,
              }}
            >
              {n.type === "text" && <span>{n.content}</span>}
              {n.type === "button" && <span>{n.content}</span>}
              {n.type === "input" && <span className="opacity-60">{n.content}</span>}
              {n.type === "image" && (
                <div className="flex h-full w-full items-center justify-center text-xs opacity-40">
                  Image
                </div>
              )}

              {selected && (
                <>
                  {(["tl", "tr", "bl", "br"] as const).map((h) => (
                    <div
                      key={h}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDrag({
                          kind: "resize-node",
                          id: n.id,
                          handle: h,
                          startX: e.clientX,
                          startY: e.clientY,
                          orig: n,
                        });
                      }}
                      className="absolute h-2.5 w-2.5 rounded-sm border border-accent bg-background"
                      style={{
                        cursor: h === "tl" || h === "br" ? "nwse-resize" : "nesw-resize",
                        top: h.startsWith("t") ? -5 : undefined,
                        bottom: h.startsWith("b") ? -5 : undefined,
                        left: h.endsWith("l") ? -5 : undefined,
                        right: h.endsWith("r") ? -5 : undefined,
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}

        {/* Marquee */}
        {drag?.kind === "marquee" && ref.current && (() => {
          const rect = ref.current.getBoundingClientRect();
          const x = (Math.min(drag.startX, drag.currentX) - rect.left) / zoom;
          const y = (Math.min(drag.startY, drag.currentY) - rect.top) / zoom;
          const w = Math.abs(drag.currentX - drag.startX) / zoom;
          const h = Math.abs(drag.currentY - drag.startY) / zoom;
          return (
            <div
              className="pointer-events-none absolute border border-accent/70 bg-accent/10"
              style={{ left: x, top: y, width: w, height: h }}
            />
          );
        })()}
      </div>
    </div>
  );
};
