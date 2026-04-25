import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Check, KeyRound } from "lucide-react";
import { toast } from "sonner";

export interface ProviderConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  // azure-only
  deployment?: string;
  apiVersion?: string;
}

export interface ProvidersState {
  active: string;
  providers: Record<string, ProviderConfig>;
}

export const PROVIDERS: {
  id: string;
  name: string;
  defaultBaseUrl: string;
  defaultModel: string;
  hint?: string;
  azure?: boolean;
}[] = [
  { id: "openai", name: "OpenAI", defaultBaseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
  { id: "azure", name: "Azure OpenAI", defaultBaseUrl: "https://YOUR-RESOURCE.openai.azure.com", defaultModel: "gpt-4o", azure: true, hint: "Use your Azure resource endpoint" },
  { id: "anthropic", name: "Anthropic", defaultBaseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-5" },
  { id: "google", name: "Google Gemini", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.5-pro" },
  { id: "mistral", name: "Mistral", defaultBaseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest" },
  { id: "groq", name: "Groq", defaultBaseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  { id: "deepseek", name: "DeepSeek", defaultBaseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  { id: "openrouter", name: "OpenRouter", defaultBaseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o" },
  { id: "xai", name: "xAI Grok", defaultBaseUrl: "https://api.x.ai/v1", defaultModel: "grok-2-latest" },
  { id: "ollama", name: "Ollama (local)", defaultBaseUrl: "http://localhost:11434/v1", defaultModel: "llama3.2", hint: "Runs locally, no key required" },
  { id: "custom", name: "Custom OpenAI-compatible", defaultBaseUrl: "https://", defaultModel: "" },
];

const STORAGE_KEY = "devcanvas.providers.v1";

const emptyConfig = (defaults: { defaultBaseUrl: string; defaultModel: string }): ProviderConfig => ({
  enabled: false,
  apiKey: "",
  baseUrl: defaults.defaultBaseUrl,
  model: defaults.defaultModel,
  deployment: "",
  apiVersion: "2024-08-01-preview",
});

const initialState = (): ProvidersState => {
  const providers: Record<string, ProviderConfig> = {};
  PROVIDERS.forEach((p) => (providers[p.id] = emptyConfig(p)));
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ProvidersState;
        return {
          active: parsed.active ?? "openai",
          providers: { ...providers, ...parsed.providers },
        };
      }
    } catch {/* noop */}
  }
  return { active: "openai", providers };
};

export const ProvidersDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [state, setState] = useState<ProvidersState>(initialState);
  const [selectedId, setSelectedId] = useState<string>("openai");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const meta = PROVIDERS.find((p) => p.id === selectedId)!;
  const cfg = state.providers[selectedId];

  const update = (patch: Partial<ProviderConfig>) =>
    setState((s) => ({ ...s, providers: { ...s.providers, [selectedId]: { ...s.providers[selectedId], ...patch } } }));

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    toast.success(`Saved · active provider: ${PROVIDERS.find((p) => p.id === state.active)?.name}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b hairline px-6 py-5">
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <KeyRound className="h-4 w-4 text-accent" />
            Model providers
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure API credentials. Keys are stored locally in your browser only.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[220px_1fr]">
          <div className="max-h-[480px] overflow-y-auto border-r hairline bg-rail/40 py-2">
            {PROVIDERS.map((p) => {
              const active = state.active === p.id;
              const enabled = state.providers[p.id]?.enabled;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between border-l-2 px-4 py-2.5 text-left text-xs transition-colors",
                    selectedId === p.id ? "border-accent bg-background" : "border-transparent hover:bg-background/50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", enabled ? "bg-accent" : "bg-muted-foreground/30")} />
                    {p.name}
                  </span>
                  {active && <Check className="h-3 w-3 text-accent" />}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl">{meta.name}</h3>
                {meta.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.hint}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">Enabled</Label>
                <Switch checked={cfg.enabled} onCheckedChange={(v) => update({ enabled: v })} />
              </div>
            </div>

            <Field label="API Key" placeholder={meta.id === "ollama" ? "Not required" : "sk-..."} value={cfg.apiKey} onChange={(v) => update({ apiKey: v })} type="password" />
            <Field label="Base URL" value={cfg.baseUrl} onChange={(v) => update({ baseUrl: v })} mono />
            <Field label="Model" value={cfg.model} onChange={(v) => update({ model: v })} mono />

            {meta.azure && (
              <>
                <Field label="Deployment name" value={cfg.deployment ?? ""} onChange={(v) => update({ deployment: v })} mono />
                <Field label="API version" value={cfg.apiVersion ?? ""} onChange={(v) => update({ apiVersion: v })} mono />
              </>
            )}

            <div className="flex items-center justify-between border-t hairline pt-4">
              <button
                onClick={() => setState((s) => ({ ...s, active: selectedId }))}
                className={cn(
                  "text-[11px] uppercase tracking-wider transition-colors",
                  state.active === selectedId ? "text-accent" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {state.active === selectedId ? "✓ Active provider" : "Set as active"}
              </button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button size="sm" onClick={save} className="bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) => (
  <div>
    <Label className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</Label>
    <Input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-9 bg-rail/40 text-xs", mono && "font-mono")}
    />
  </div>
);
