import {
  Sparkles,
  Settings2,
  Code2,
  Wand2,
  Plus,
  ArrowRightCircle,
  Loader2,
  MessageSquarePlus,
  Share2,
  Download,
  Wand,
  LayoutGrid,
  Palette,
  Frame,
  ChevronDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Fidelity } from "@/lib/scene";

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
  onAutoFix: () => void;
  autoFixing: boolean;
  generating: boolean;
  peerCount: number;
  layoutPreview: boolean;
  onToggleLayoutPreview: () => void;
  fidelity: Fidelity;
  onToggleFidelity: () => void;
  includeDesignSystem: boolean;
  onToggleDesignSystem: () => void;
  onTileStoryboard: () => void;
}

/** A small row that renders a checkmark slot so toggle items align nicely. */
const ToggleRow = ({
  active,
  icon: Icon,
  label,
  hint,
}: {
  active?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
}) => (
  <div className="flex w-full items-center gap-2">
    <span className="flex h-3.5 w-3.5 items-center justify-center text-accent">
      {active ? <Check className="h-3 w-3" /> : null}
    </span>
    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    <span className="flex-1 text-[12px]">{label}</span>
    {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
  </div>
);

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
  onAutoFix,
  autoFixing,
  generating,
  peerCount,
  layoutPreview,
  onToggleLayoutPreview,
  fidelity,
  onToggleFidelity,
  includeDesignSystem,
  onToggleDesignSystem,
  onTileStoryboard,
}: Props) => {
  return (
    <div className="flex h-14 items-center gap-3 border-b hairline panel-surface px-4">
      {/* ─── Brand + master menu ─────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="group flex items-center gap-2 rounded-md border hairline bg-rail/40 px-2.5 py-1.5 transition-colors hover:border-accent/50"
            title="DevCanvas menu"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Sparkles className="h-3 w-3" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-sm leading-none">DevCanvas</span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">v0.2</span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Canvas
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={onAddPage}>
            <ToggleRow icon={Plus} label="New page" hint="P" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleConnect}>
            <ToggleRow active={connectMode} icon={ArrowRightCircle} label="Connect pages" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleComment}>
            <ToggleRow active={commentMode} icon={MessageSquarePlus} label="Comment mode" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onTileStoryboard}>
            <ToggleRow icon={Frame} label="Tile storyboard" />
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            AI
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={onAutoFix} disabled={autoFixing}>
            <div className="flex w-full items-center gap-2">
              <span className="flex h-3.5 w-3.5 items-center justify-center text-accent">
                {autoFixing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              </span>
              <Wand className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 text-[12px]">Auto-fix layout</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleLayoutPreview}>
            <ToggleRow active={layoutPreview} icon={LayoutGrid} label="Layout preview" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleDesignSystem}>
            <ToggleRow active={includeDesignSystem} icon={Palette} label="Include DS sheet" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleFidelity}>
            <ToggleRow
              active={fidelity === "hifi"}
              icon={Sparkles}
              label={fidelity === "hifi" ? "Hi-fi mode" : "Wireframe mode"}
              hint={fidelity === "hifi" ? "color" : "mono"}
            />
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Project
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={onShowCode}>
            <ToggleRow icon={Code2} label="View generated code" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenExport}>
            <ToggleRow icon={Download} label="Export project" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenShare}>
            <ToggleRow
              icon={Share2}
              label="Share & collaborate"
              hint={peerCount > 0 ? `${peerCount + 1}` : undefined}
            />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenSettings}>
            <ToggleRow icon={Settings2} label="Provider settings" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ─── Prompt bar (gets all the spare width) ───────────────────── */}
      <div className="flex flex-1 items-center gap-2 rounded-md border hairline bg-rail/40 px-3 py-1.5 transition-colors focus-within:border-accent/60">
        <Wand2 className="h-4 w-4 shrink-0 text-accent" />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !generating) onGenerateWireframe();
          }}
          placeholder="Describe any product — e.g. 'Patient intake portal for a dental clinic with appointments, records, billing'"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          disabled={generating}
        />
        <div className="flex items-center gap-1 rounded border hairline bg-background/40 p-0.5">
          {(["wireframe", "hifi"] as Fidelity[]).map((f) => (
            <button
              key={f}
              onClick={() => fidelity !== f && onToggleFidelity()}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors",
                fidelity === f
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={f === "wireframe" ? "Low-fi grayscale" : "High-fidelity colored"}
            >
              {f === "wireframe" ? "Wire" : "Hi-fi"}
            </button>
          ))}
        </div>
        <button
          onClick={onToggleDesignSystem}
          className={cn(
            "flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] uppercase tracking-wider transition-colors",
            includeDesignSystem
              ? "border-accent bg-accent text-accent-foreground"
              : "hairline bg-background/40 text-muted-foreground hover:text-foreground",
          )}
          title="Include a design-system sheet (Page 0) when generating"
        >
          <Palette className="h-3 w-3" /> DS
        </button>
        <button
          onClick={onGenerateWireframe}
          disabled={generating}
          className="flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-[11px] uppercase tracking-wider text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generating ? "Drafting" : "Generate"}
        </button>
      </div>

      {/* ─── Mode switch (kept inline, it's used constantly) ─────────── */}
      <div className="flex shrink-0 rounded-md border hairline bg-rail/40 p-0.5">
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
    </div>
  );
};
