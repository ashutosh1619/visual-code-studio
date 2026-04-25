import { Sparkles, Settings2, Code2, Wand2, Plus, ArrowRightCircle, Loader2, MessageSquarePlus, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Mode = "design" | "code" | "hybrid";

interface Props {
  prompt: string;
  setPrompt: (s: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  onGenerateWireframe: () => void;
  onShowCode: () => void;
  onOpenSettings: () => void;
  onAddPage: () => void;
  connectMode: boolean;
  onToggleConnect: () => void;
  commentMode: boolean;
  onToggleComment: () => void;
  onOpenShare: () => void;
  onOpenExport: () => void;
  generating: boolean;
  peerCount: number;
}

export const Toolbar = ({
  prompt,
  setPrompt,
  mode,
  setMode,
  onGenerateWireframe,
  onShowCode,
  onOpenSettings,
  onAddPage,
  connectMode,
  onToggleConnect,
  commentMode,
  onToggleComment,
  onOpenShare,
  onOpenExport,
  generating,
  peerCount,
}: Props) => {
  return (
    <div className="flex h-14 items-center justify-between border-b hairline panel-surface px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg leading-none">DevCanvas</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">v0.2</span>
          </div>
        </div>
        <span className="h-6 w-px bg-hairline" />
        <button
          onClick={onAddPage}
          className="flex items-center gap-1.5 rounded-md border hairline bg-rail/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Page
        </button>
        <button
          onClick={onToggleConnect}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition-colors",
            connectMode
              ? "border-accent bg-accent text-accent-foreground"
              : "hairline bg-rail/40 text-muted-foreground hover:border-accent/40 hover:text-foreground",
          )}
        >
          <ArrowRightCircle className="h-3 w-3" /> Connect
        </button>
        <button
          onClick={onToggleComment}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition-colors",
            commentMode
              ? "border-accent bg-accent text-accent-foreground"
              : "hairline bg-rail/40 text-muted-foreground hover:border-accent/40 hover:text-foreground",
          )}
        >
          <MessageSquarePlus className="h-3 w-3" /> Comment
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center gap-2 px-6">
        <div className="flex w-full max-w-2xl items-center gap-2 rounded-md border hairline bg-rail/40 px-3 py-1.5 transition-colors focus-within:border-accent/60">
          <Wand2 className="h-3.5 w-3.5 text-accent" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !generating) onGenerateWireframe();
            }}
            placeholder="Describe the product — e.g. 'task manager with auth, dashboard, and settings'"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            disabled={generating}
          />
          <button
            onClick={onGenerateWireframe}
            disabled={generating}
            className="flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-[10px] uppercase tracking-wider text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {generating ? "Drafting" : "Generate flow"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-md border hairline bg-rail/40 p-0.5">
          {(["design", "code", "hybrid"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] capitalize transition-colors",
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={onOpenSettings} className="h-8">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>

        <Button variant="ghost" size="sm" onClick={onOpenShare} className="h-8 gap-1.5">
          <Share2 className="h-3.5 w-3.5" />
          {peerCount > 0 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-medium leading-none text-accent-foreground">
              {peerCount + 1}
            </span>
          )}
        </Button>

        <Button variant="outline" size="sm" onClick={onOpenExport} className="h-8">
          <Download className="mr-1.5 h-3 w-3" />
          Export
        </Button>

        <Button
          size="sm"
          onClick={onShowCode}
          variant="outline"
          className="h-8"
        >
          <Code2 className="mr-1.5 h-3 w-3" />
          Code
        </Button>
      </div>
    </div>
  );
};
