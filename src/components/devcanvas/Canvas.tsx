import { useEffect, useRef, useState } from "react";
import type { CanvasNode } from "@/lib/scene";
import { cn } from "@/lib/utils";

interface Props {
  nodes: CanvasNode[];
  selectedIds: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  onDropElement: (type: string, x: number, y: number) => void;
  zoom: number;
  onCursor: (p: { x: number; y: number }) => void;
}

type DragState =
  | { kind: "move"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; id: string; handle: "br" | "tr" | "bl" | "tl" | "r" | "b"; startX: number; startY: number; orig: CanvasNode }
  | null;

export const Canvas = ({ nodes, selectedIds, onSelect, onUpdate, onDropElement, zoom, onCursor }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      if (drag.kind === "move") {
        onUpdate(drag.id, {
          position: { x: drag.origX + dx, y: drag.origY + dy },
        });
      } else if (drag.kind === "resize") {
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
        onUpdate(drag.id, { position: { x, y }, size: { width: w, height: h } });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, onUpdate, zoom]);

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onCursor({
      x: Math.round((e.clientX - rect.left) / zoom),
      y: Math.round((e.clientY - rect.top) / zoom),
    });
  };

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-auto bg-canvas canvas-grid"
      onMouseMove={handleMove}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData("devcanvas/type");
        if (!type || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        onDropElement(type, x, y);
      }}
    >
      <div
        className="relative"
        style={{
          width: 4000,
          height: 3000,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {nodes.map((n) => {
          const selected = selectedIds.includes(n.id);
          return (
            <div
              key={n.id}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(n.id, e.shiftKey);
                setDrag({
                  kind: "move",
                  id: n.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: n.position.x,
                  origY: n.position.y,
                });
              }}
              className={cn(
                "absolute cursor-move group transition-shadow",
                selected && "ring-2 ring-accent ring-offset-0"
              )}
              style={{
                left: n.position.x,
                top: n.position.y,
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
              {n.type === "input" && (
                <span className="opacity-60">{n.content}</span>
              )}
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
                          kind: "resize",
                          id: n.id,
                          handle: h,
                          startX: e.clientX,
                          startY: e.clientY,
                          orig: n,
                        });
                      }}
                      className="absolute h-2.5 w-2.5 rounded-sm border border-accent bg-background"
                      style={{
                        cursor:
                          h === "tl" || h === "br" ? "nwse-resize" : "nesw-resize",
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
