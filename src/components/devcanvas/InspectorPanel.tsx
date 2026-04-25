import { useState } from "react";
import type { CanvasNode, TextStyleRole } from "@/lib/scene";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Eye, EyeOff, Sparkles, Component as ComponentIcon, ArrowUpToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  nodes: CanvasNode[];
  selected: CanvasNode | null;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  onUpdateStyle: (id: string, patch: Partial<CanvasNode["style"]>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  /** Present only when the selected node is a component instance. */
  onPushToMaster?: () => void;
}

const TEXT_ROLES: TextStyleRole[] = ["display", "h1", "h2", "h3", "body", "caption", "label"];

export const InspectorPanel = ({ nodes, selected, onUpdate, onUpdateStyle, onDelete, onSelect, onPushToMaster }: Props) => {
  const [tab, setTab] = useState("properties");

  return (
    <div className="flex h-full w-[300px] flex-col panel-surface border-l">
      <div className="border-b hairline px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Inspector</p>
        <h2 className="mt-1 font-display text-2xl leading-none">
          {selected ? selected.type : "Nothing selected"}
        </h2>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-3 mt-3 grid h-9 grid-cols-4 bg-rail/60">
          <TabsTrigger value="properties" className="text-[11px]">Style</TabsTrigger>
          <TabsTrigger value="layout" className="text-[11px]">Layout</TabsTrigger>
          <TabsTrigger value="layers" className="text-[11px]">Layers</TabsTrigger>
          <TabsTrigger value="ai" className="text-[11px]">AI</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <TabsContent value="properties" className="m-0 space-y-5">
            {selected ? (
              <>
                <Group title="Position & Size">
                  <Pair>
                    <Field label="X" value={Math.round(selected.position.x)} onChange={(v) => onUpdate(selected.id, { position: { ...selected.position, x: v } })} />
                    <Field label="Y" value={Math.round(selected.position.y)} onChange={(v) => onUpdate(selected.id, { position: { ...selected.position, y: v } })} />
                  </Pair>
                  <Pair>
                    <Field label="W" value={Math.round(selected.size.width)} onChange={(v) => onUpdate(selected.id, { size: { ...selected.size, width: v } })} />
                    <Field label="H" value={Math.round(selected.size.height)} onChange={(v) => onUpdate(selected.id, { size: { ...selected.size, height: v } })} />
                  </Pair>
                </Group>

                <Group title="Appearance">
                  <ColorField label="Background" value={selected.style.background ?? "#1a1714"} onChange={(v) => onUpdateStyle(selected.id, { background: v })} />
                  {(selected.type === "text" || selected.type === "button" || selected.type === "input") && (
                    <ColorField label="Text" value={selected.style.color ?? "#e9e4d8"} onChange={(v) => onUpdateStyle(selected.id, { color: v })} />
                  )}
                  <Field label="Radius" value={selected.style.borderRadius ?? 0} onChange={(v) => onUpdateStyle(selected.id, { borderRadius: v })} />
                  <Field label="Padding" value={selected.style.padding ?? 0} onChange={(v) => onUpdateStyle(selected.id, { padding: v })} />
                </Group>

                {selected.content !== undefined && (
                  <Group title="Content">
                    <Input
                      value={selected.content}
                      onChange={(e) => onUpdate(selected.id, { content: e.target.value })}
                      className="h-8 bg-rail/40 text-xs"
                    />
                  </Group>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(selected.id)}
                  className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete element
                </Button>
              </>
            ) : (
              <Empty text="Select an element to edit its properties." />
            )}
          </TabsContent>

          <TabsContent value="layout" className="m-0">
            {selected ? (
              <Group title="Display">
                <SegmentedField
                  label="Display"
                  value={selected.style.display ?? "block"}
                  options={["block", "flex"]}
                  onChange={(v) => onUpdateStyle(selected.id, { display: v as "block" | "flex" })}
                />
                {selected.style.display === "flex" && (
                  <>
                    <SegmentedField
                      label="Direction"
                      value={selected.style.flexDirection ?? "row"}
                      options={["row", "column"]}
                      onChange={(v) => onUpdateStyle(selected.id, { flexDirection: v as "row" | "column" })}
                    />
                    <SegmentedField
                      label="Align"
                      value={selected.style.alignItems ?? "start"}
                      options={["start", "center", "end"]}
                      onChange={(v) => onUpdateStyle(selected.id, { alignItems: v as "start" | "center" | "end" })}
                    />
                    <SegmentedField
                      label="Justify"
                      value={selected.style.justifyContent ?? "start"}
                      options={["start", "center", "end", "between"]}
                      onChange={(v) => onUpdateStyle(selected.id, { justifyContent: v as "start" | "center" | "end" | "between" })}
                    />
                  </>
                )}
              </Group>
            ) : (
              <Empty text="Select an element." />
            )}
          </TabsContent>

          <TabsContent value="layers" className="m-0">
            <div className="space-y-1">
              {nodes.length === 0 && <Empty text="No layers yet." />}
              {[...nodes].sort((a, b) => b.zIndex - a.zIndex).map((n) => (
                <button
                  key={n.id}
                  onClick={() => onSelect(n.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                    selected?.id === n.id ? "bg-accent-soft text-accent" : "hover:bg-rail/60"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Eye className="h-3 w-3 opacity-50" />
                    <span className="capitalize">{n.type}</span>
                    <span className="font-mono text-[10px] opacity-40">#{n.id.slice(-4)}</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-40">z{n.zIndex}</span>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="m-0 space-y-3">
            <div className="rounded-md border hairline bg-accent-soft/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium">Suggestions</span>
              </div>
              <ul className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
                <li>• Add validation states to inputs</li>
                <li>• Improve spacing rhythm (8px grid)</li>
                <li>• Suggest navigation between scenes</li>
              </ul>
              <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Configure a provider in Settings · ⌘K
              </p>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2.5">
    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
    {children}
  </div>
);

const Pair = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-2">{children}</div>
);

const Field = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div>
    <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 bg-rail/40 font-mono text-xs"
    />
  </div>
);

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-2 rounded-md border hairline bg-rail/40 px-2 py-1">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent font-mono text-xs outline-none"
      />
    </div>
  </div>
);

const SegmentedField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) => (
  <div>
    <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="flex rounded-md border hairline bg-rail/40 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "flex-1 rounded px-2 py-1 text-[11px] capitalize transition-colors",
            value === o ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center gap-2 py-10 text-center">
    <EyeOff className="h-4 w-4 text-muted-foreground/50" />
    <p className="text-[11px] text-muted-foreground">{text}</p>
  </div>
);
