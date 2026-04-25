import { useState } from "react";
import { Palette, Type, Square, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PRESET_THEMES,
  type DesignTokens,
} from "@/lib/tokens";

interface Props {
  themeKey: string;
  tokens: DesignTokens;
  onApplyPreset: (key: string) => void;
  onUpdateTokens: (next: DesignTokens) => void;
}

export const TokensPanel = ({ themeKey, tokens, onApplyPreset, onUpdateTokens }: Props) => {
  const [section, setSection] = useState<"theme" | "color" | "type" | "radius">("theme");

  const updateColor = (key: keyof DesignTokens["colors"], value: string) =>
    onUpdateTokens({ ...tokens, colors: { ...tokens.colors, [key]: value } });

  const updateType = (patch: Partial<DesignTokens["type"]>) =>
    onUpdateTokens({ ...tokens, type: { ...tokens.type, ...patch } });

  const updateRadius = (key: keyof DesignTokens["radius"], value: number) =>
    onUpdateTokens({ ...tokens, radius: { ...tokens.radius, [key]: value } });

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border hairline bg-rail/40 p-0.5 text-[10px]">
        {(
          [
            { id: "theme", label: "Theme", icon: Palette },
            { id: "color", label: "Color", icon: Palette },
            { id: "type", label: "Type", icon: Type },
            { id: "radius", label: "Radius", icon: Square },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 transition-colors",
              section === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {section === "theme" && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Presets</p>
          {Object.entries(PRESET_THEMES).map(([key, preset]) => {
            const active = themeKey === key;
            return (
              <button
                key={key}
                onClick={() => onApplyPreset(key)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all",
                  active ? "border-accent bg-accent-soft/40" : "hairline bg-rail/30 hover:border-accent/40",
                )}
              >
                <div className="flex gap-1">
                  <Swatch color={preset.tokens.colors.background} />
                  <Swatch color={preset.tokens.colors.surface} />
                  <Swatch color={preset.tokens.colors.accent} />
                  <Swatch color={preset.tokens.colors.text} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">{preset.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground/70">
                    {preset.tokens.type.fontFamily} · {preset.tokens.radius.md}px
                  </p>
                </div>
                {active && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
          <p className="pt-2 text-[10px] leading-relaxed text-muted-foreground/70">
            Picking a preset re-themes every page and element on the canvas.
          </p>
        </div>
      )}

      {section === "color" && (
        <div className="space-y-3">
          {(Object.keys(tokens.colors) as Array<keyof DesignTokens["colors"]>).map((k) => (
            <ColorRow
              key={k}
              label={k}
              value={tokens.colors[k]}
              onChange={(v) => updateColor(k, v)}
            />
          ))}
        </div>
      )}

      {section === "type" && (
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Family
            </Label>
            <div className="flex rounded-md border hairline bg-rail/40 p-0.5">
              {(["sans", "serif", "mono"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => updateType({ fontFamily: f })}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-[11px] capitalize transition-colors",
                    tokens.type.fontFamily === f
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <NumRow
            label="Base size"
            suffix="px"
            value={tokens.type.base}
            min={10}
            max={24}
            onChange={(v) => updateType({ base: v })}
          />
          <NumRow
            label="Scale ratio"
            value={tokens.type.scale}
            step={0.05}
            min={1.1}
            max={1.6}
            onChange={(v) => updateType({ scale: v })}
          />
          <div className="rounded-md border hairline bg-rail/30 p-3 text-foreground">
            <p style={{ fontSize: Math.round(tokens.type.base * Math.pow(tokens.type.scale, 3)) }}>
              Heading
            </p>
            <p
              style={{ fontSize: Math.round(tokens.type.base * tokens.type.scale) }}
              className="text-muted-foreground"
            >
              Subhead
            </p>
            <p style={{ fontSize: tokens.type.base }} className="text-muted-foreground/80">
              Body sample text
            </p>
          </div>
        </div>
      )}

      {section === "radius" && (
        <div className="space-y-3">
          {(Object.keys(tokens.radius) as Array<keyof DesignTokens["radius"]>).map((k) => (
            <NumRow
              key={k}
              label={k.toUpperCase()}
              suffix="px"
              value={tokens.radius[k]}
              min={0}
              max={32}
              onChange={(v) => updateRadius(k, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Swatch = ({ color }: { color: string }) => (
  <span
    className="h-5 w-5 rounded-sm ring-1 ring-black/10"
    style={{ background: color }}
  />
);

const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
      {label.replace(/([A-Z])/g, " $1")}
    </Label>
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

const NumRow = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) => (
  <div>
    <div className="mb-1 flex items-center justify-between">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <span className="font-mono text-[10px] text-muted-foreground">
        {value}
        {suffix}
      </span>
    </div>
    <input
      type="range"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className="w-full accent-[hsl(var(--accent))]"
    />
  </div>
);
