import { Square, Type, Image as ImageIcon, MousePointerClick, TextCursorInput, Layers, LayoutTemplate } from "lucide-react";
import type { NodeType } from "@/lib/scene";

const elements: { type: NodeType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "box", label: "Box", icon: Square },
  { type: "text", label: "Text", icon: Type },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "input", label: "Input", icon: TextCursorInput },
];

export const ElementsPanel = ({ onAdd }: { onAdd: (type: NodeType) => void }) => {
  return (
    <div className="flex h-full w-[260px] flex-col panel-surface border-r">
      <div className="border-b hairline px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Library</p>
        <h2 className="mt-1 font-display text-2xl leading-none">Elements</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <Section title="Basic" icon={Layers}>
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
        </Section>

        <Section title="Layout" icon={LayoutTemplate}>
          <div className="space-y-1.5">
            {["Stack", "Row", "Grid", "Section"].map((l) => (
              <div
                key={l}
                className="flex items-center justify-between rounded-md border hairline bg-rail/30 px-3 py-2 text-xs text-muted-foreground"
              >
                <span>{l}</span>
                <span className="text-[10px] uppercase tracking-wider opacity-50">soon</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="border-t hairline px-5 py-3">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Drag onto the canvas, or double-click to insert at origin.
        </p>
      </div>
    </div>
  );
};

const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) => (
  <div className="mb-6">
    <div className="mb-2 flex items-center gap-2 px-1">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</span>
    </div>
    {children}
  </div>
);
