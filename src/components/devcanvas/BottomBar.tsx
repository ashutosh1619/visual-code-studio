import { Minus, Plus, MousePointer2 } from "lucide-react";

interface Props {
  zoom: number;
  setZoom: (z: number) => void;
  cursor: { x: number; y: number };
  mode: string;
  nodeCount: number;
}

export const BottomBar = ({ zoom, setZoom, cursor, mode, nodeCount }: Props) => {
  return (
    <div className="flex h-8 items-center justify-between border-t hairline panel-surface px-4 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Ready
        </span>
        <span className="font-mono">{nodeCount} nodes</span>
        <span className="capitalize">{mode} mode</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 font-mono">
          <MousePointer2 className="h-3 w-3" />
          {cursor.x}, {cursor.y}
        </span>

        <div className="flex items-center gap-1 rounded border hairline bg-rail/40 px-1.5 py-0.5">
          <button onClick={() => setZoom(Math.max(0.25, zoom - 0.1))} className="hover:text-foreground">
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-10 text-center font-mono text-[10px]">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="hover:text-foreground">
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
