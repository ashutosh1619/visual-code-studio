import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Github, Loader2, FileCode2, Copy } from "lucide-react";
import { downloadProjectZip } from "@/lib/exportProject";
import type { CanvasNode, Page, Edge } from "@/lib/scene";
import { toast } from "sonner";

export const ExportDialog = ({
  open,
  onOpenChange,
  pages,
  nodes,
  edges,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pages: Page[];
  nodes: CanvasNode[];
  edges: Edge[];
}) => {
  const [name, setName] = useState("devcanvas-project");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"zip" | "github">("zip");

  const handleDownload = async () => {
    setBusy(true);
    try {
      await downloadProjectZip({ pages, nodes, edges, projectName: name });
      toast.success("Project exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd).catch(() => {});
    toast.success("Command copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b hairline px-6 py-4 space-y-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Handoff</p>
          <DialogTitle className="font-display text-2xl">Export project</DialogTitle>
        </DialogHeader>

        <div className="flex border-b hairline">
          {(
            [
              { id: "zip", label: "ZIP bundle", icon: FileCode2 },
              { id: "github", label: "GitHub", icon: Github },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-xs transition-colors ${
                tab === t.id
                  ? "border-b border-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "zip" ? (
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
                Project name
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="rounded-md border hairline bg-rail/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <p className="mb-2 text-foreground">You'll get a ready-to-run Vite project:</p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>{pages.length} page component{pages.length === 1 ? "" : "s"} in <code className="font-mono text-foreground/80">src/generated/Pages.tsx</code></li>
                <li>Tab navigation matching your flow ({edges.length} connection{edges.length === 1 ? "" : "s"})</li>
                <li>Tailwind + TypeScript pre-configured</li>
                <li>Raw scene saved to <code className="font-mono text-foreground/80">scene.json</code> for re-import</li>
              </ul>
            </div>

            <Button
              onClick={handleDownload}
              disabled={busy}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Bundling…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download .zip
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Push the exported project to GitHub. Once it's there you can keep iterating in
              DevCanvas and Lovable's two-way sync will mirror changes both directions.
            </p>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                1 · Download the ZIP first
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9"
                onClick={handleDownload}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-2 h-3.5 w-3.5" />
                )}
                Download project bundle
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                2 · Initialize and push
              </p>
              {[
                `cd ${name} && git init -b main`,
                `git add . && git commit -m "Initial commit from DevCanvas"`,
                `gh repo create ${name} --public --source=. --push`,
              ].map((cmd) => (
                <div
                  key={cmd}
                  className="flex items-center gap-2 rounded-md border hairline bg-rail/40 px-2.5 py-1.5"
                >
                  <code className="flex-1 truncate font-mono text-[11px] text-foreground/80">
                    {cmd}
                  </code>
                  <button
                    onClick={() => copyCommand(cmd)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-md border hairline bg-accent/5 p-3 text-[11px] leading-relaxed">
              <p className="text-foreground/90">
                <strong>Pro tip:</strong> Connect GitHub through the Lovable editor (Connectors →
                GitHub) and your repo stays in sync with the canvas — push from your editor, pull
                back into DevCanvas.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
