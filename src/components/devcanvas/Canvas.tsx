import { useEffect, useRef, useState } from "react";
import type { CanvasNode, Page, Edge } from "@/lib/scene";
import { cn } from "@/lib/utils";

interface Props {
  pages: Page[];
  nodes: CanvasNode[];
  edges: Edge[];
  selectedIds: string[];
  selectedPageId: string | null;
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectPage: (id: string | null) => void;
  onUpdateNode: (id: string, patch: Partial<CanvasNode>) => void;
  onUpdatePage: (id: string, patch: Partial<Page>) => void;
  onDropElement: (type: string, x: number, y: number, pageId: string) => void;
  zoom: number;
  onCursor: (p: { x: number; y: number }) => void;
  /** When true, clicking two pages creates an edge between them. */
  connectMode: boolean;
  onConnectPages: (fromId: string, toId: string) => void;
}

type DragState =
  | { kind: "move-node"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize-node"; id: string; handle: "br" | "tr" | "bl" | "tl"; startX: number; startY: number; orig: CanvasNode }
  | { kind: "move-page"; id: string; startX: number; startY: number; origX: number; origY: number }
  | null;

export const Canvas = ({
  pages,
  nodes,
  edges,
  selectedIds,
  selectedPageId,
  onSelect,
  onSelectPage,
  onUpdateNode,
  onUpdatePage,
  onDropElement,
  zoom,
  onCursor,
  connectMode,
  onConnectPages,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      if (drag.kind === "move-node") {
        onUpdateNode(drag.id, { position: { x: drag.origX + dx, y: drag.origY + dy } });
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
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, onUpdateNode, onUpdatePage, zoom]);

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

  // Compute page anchor points for edges
  const pageById = new Map(pages.map((p) => [p.id, p]));

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-auto bg-canvas canvas-grid"
      onMouseMove={handleMove}
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
        // Find target page (drop into the page under cursor); fallback: first page
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
          {/* Provisional arrow while choosing target in connect mode */}
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
              {/* Page label */}
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
              </div>

              {/* Page frame */}
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

        {/* Nodes (rendered on top, positioned absolute relative to canvas) */}
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
                onSelect(n.id, e.shiftKey);
                setDrag({
                  kind: "move-node",
                  id: n.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: n.position.x,
                  origY: n.position.y,
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
      </div>
    </div>
  );
};
