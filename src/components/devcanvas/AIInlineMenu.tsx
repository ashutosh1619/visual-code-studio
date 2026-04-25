import { useEffect, useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import type { CanvasNode } from "@/lib/scene";
import { inlineEditNode } from "@/lib/ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  /** First selected node (anchor for the floating menu) */
  node: CanvasNode | null;
  /** Absolute-on-canvas (post-zoom) position of the node's top-right corner */
  anchor: { x: number; y: number } | null;
  onApply: (patch: Partial<CanvasNode> & { style?: Partial<CanvasNode["style"]> }) => void;
}

const PRESETS = [
  "Make this a primary CTA",
  "Turn into a pricing card",
  "Add an empty state look",
  "Make text larger and bolder",
  "Soften corners and shadow",
];

export const AIInlineMenu = ({ node, anchor, onApply }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState("");

  // Close menu when selection changes
  useEffect(() => {
    setOpen(false);
    setInstruction("");
  }, [node?.id]);

  if (!node || !anchor) return null;

  const run = async (prompt: string) => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      const patch = await inlineEditNode(node, prompt.trim());
      onApply(patch);
      toast.success("AI edit applied");
      setOpen(false);
      setInstruction("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI edit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="pointer-events-auto absolute z-[60]"
      style={{ left: anchor.x + 8, top: anchor.y - 4 }}
    >
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-accent-foreground shadow-lg transition-transform hover:scale-105"
          title="Edit with AI"
        >
          <Sparkles className="h-3 w-3" /> AI
        </button>
      ) : (
        <div className="w-64 rounded-md border hairline bg-background/95 p-2 shadow-xl backdrop-blur">
          <div className="flex items-center gap-1.5 border-b hairline px-1 pb-1.5">
            <Wand2 className="h-3 w-3 text-accent" />
            <input
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") run(instruction);
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Describe the change…"
              disabled={busy}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
            {busy && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => run(p)}
                disabled={busy}
                className={cn(
                  "block w-full rounded px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors",
                  "hover:bg-rail/60 hover:text-foreground disabled:opacity-50",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
