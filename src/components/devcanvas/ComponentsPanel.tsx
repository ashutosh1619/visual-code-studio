import { useEffect, useState } from "react";
import { Component, Trash2, Download as DownloadIcon } from "lucide-react";
import {
  loadComponents,
  saveComponents,
  componentFromNodes,
  type SavedComponent,
} from "@/lib/components";
import type { CanvasNode } from "@/lib/scene";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  selectedNodes: CanvasNode[];
  onInsert: (cmp: SavedComponent) => void;
}

export const ComponentsPanel = ({ selectedNodes, onInsert }: Props) => {
  const [list, setList] = useState<SavedComponent[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setList(loadComponents());
  }, []);

  const persist = (next: SavedComponent[]) => {
    setList(next);
    saveComponents(next);
  };

  const save = () => {
    if (selectedNodes.length === 0) {
      toast.error("Select one or more elements first");
      return;
    }
    try {
      const cmp = componentFromNodes(selectedNodes, name || `Component ${list.length + 1}`);
      persist([cmp, ...list]);
      setName("");
      toast.success(`Saved · ${cmp.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const remove = (id: string) => {
    persist(list.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border hairline bg-rail/30 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Save selection
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={selectedNodes.length ? `From ${selectedNodes.length} element${selectedNodes.length === 1 ? "" : "s"}` : "Select elements first"}
          className="w-full rounded-md border hairline bg-background/60 px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60"
        />
        <button
          onClick={save}
          disabled={selectedNodes.length === 0}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-[11px] font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Component className="h-3 w-3" /> Save as component
        </button>
      </div>

      <div>
        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Library · {list.length}
        </p>
        {list.length === 0 ? (
          <div className="rounded-md border border-dashed hairline px-3 py-6 text-center">
            <Component className="mx-auto h-4 w-4 text-muted-foreground/50" />
            <p className="mt-2 text-[11px] text-muted-foreground">
              No components yet. Select elements on the canvas and save them as a reusable block.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {list.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md border hairline bg-rail/30 px-3 py-2 transition-colors hover:border-accent/40",
                )}
              >
                <div className="flex h-8 w-10 items-center justify-center rounded bg-background/60 text-[9px] font-mono text-muted-foreground">
                  {c.bounds.width}×{c.bounds.height}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{c.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground/70">
                    {c.nodes.length} layer{c.nodes.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => onInsert(c)}
                  className="rounded p-1 text-muted-foreground hover:text-accent"
                  title="Insert instance"
                >
                  <DownloadIcon className="h-3 w-3" />
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
