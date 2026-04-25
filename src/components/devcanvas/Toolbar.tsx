import { Sparkles, Settings2, Play, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Mode = "design" | "code" | "hybrid";

interface Props {
  prompt: string;
  setPrompt: (s: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  onGenerate: () => void;
  onOpenSettings: () => void;
  onPromptToScene: () => void;
}

export const Toolbar = ({ prompt, setPrompt, mode, setMode, onGenerate, onOpenSettings, onPromptToScene }: Props) => {
  return (
    <div className="flex h-14 items-center justify-between border-b hairline panel-surface px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg leading-none">DevCanvas</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">v0.1</span>
          </div>
        </div>
        <span className="h-6 w-px bg-hairline" />
        <span className="text-xs text-muted-foreground">untitled-scene.dvc</span>
      </div>

      <div className="flex flex-1 items-center justify-center gap-2 px-6">
        <div className="flex w-full max-w-xl items-center gap-2 rounded-md border hairline bg-rail/40 px-3 py-1.5 transition-colors focus-within:border-accent/60">
          <Wand2 className="h-3.5 w-3.5 text-accent" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onPromptToScene()}
            placeholder="Describe what to build — e.g. 'login screen with email + password'"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          />
          <button
            onClick={onPromptToScene}
            className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent"
          >
            ↵
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
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={onOpenSettings} className="h-8">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          size="sm"
          onClick={onGenerate}
          className="h-8 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Play className="mr-1.5 h-3 w-3 fill-current" />
          Generate
        </Button>
      </div>
    </div>
  );
};
