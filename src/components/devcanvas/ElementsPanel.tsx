import { useState } from "react";
import {
  Square,
  Type,
  Image as ImageIcon,
  MousePointerClick,
  TextCursorInput,
  Layers,
  Component,
  Palette,
} from "lucide-react";
import type { CanvasNode, NodeType } from "@/lib/scene";
import { cn } from "@/lib/utils";
import { ComponentsPanel } from "./ComponentsPanel";
import { TokensPanel } from "./TokensPanel";
import type { SavedComponent } from "@/lib/components";
import type { DesignTokens } from "@/lib/tokens";

const elements: { type: NodeType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "box", label: "Box", icon: Square },
  { type: "text", label: "Text", icon: Type },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "input", label: "Input", icon: TextCursorInput },
];

interface Props {
  onAdd: (type: NodeType) => void;
  selectedNodes: CanvasNode[];
  onInsertComponent: (cmp: SavedComponent) => void;
  themeKey: string;
  tokens: DesignTokens;
  onApplyPreset: (key: string) => void;
  onUpdateTokens: (next: DesignTokens) => void;
}

type Tab = "elements" | "components" | "tokens";

export const ElementsPanel = ({
  onAdd,
  selectedNodes,
  onInsertComponent,
  themeKey,
  tokens,
  onApplyPreset,
  onUpdateTokens,
}: Props) => {
  const [tab, setTab] = useState<Tab>("elements");

  return (
    <div className="flex h-full w-[280px] flex-col panel-surface border-r">
      <div className="border-b hairline px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Library</p>
        <h2 className="mt-1 font-display text-2xl leading-none">
          {tab === "elements" ? "Elements" : tab === "components" ? "Components" : "Tokens"}
        </h2>
      </div>

      <div className="flex border-b hairline">
        {(
          [
            { id: "elements", label: "Elements", icon: Layers },
            { id: "components", label: "Components", icon: Component },
            { id: "tokens", label: "Tokens", icon: Palette },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[10px] uppercase tracking-wider transition-colors",
              tab === t.id
                ? "border-b border-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {tab === "elements" && (
          <div className="grid grid-cols-2 gap-2">
            {elements.map((el) => (
              <button
                key={el.type}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("devcanvas/type", el.type)}
                onDoubleClick={() => onAdd(el.type)}
                className="group flex flex-col items-start gap-2 rounded-md border hairline bg-rail/40 p-3 text-left transition-all hover:border-accent/50 hover:bg-accent-soft/30"
              >
                <el.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent" />
                <span className="text-xs font-medium">{el.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "components" && (
          <ComponentsPanel
            selectedNodes={selectedNodes}
            onInsert={onInsertComponent}
          />
        )}

        {tab === "tokens" && (
          <TokensPanel
            themeKey={themeKey}
            tokens={tokens}
            onApplyPreset={onApplyPreset}
            onUpdateTokens={onUpdateTokens}
          />
        )}
      </div>

      <div className="border-t hairline px-5 py-3">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {tab === "elements"
            ? "Drag onto the canvas, or double-click to insert."
            : tab === "components"
            ? "Save groups of elements as reusable components."
            : "Theme the entire canvas with one click."}
        </p>
      </div>
    </div>
  );
};
