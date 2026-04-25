import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

export const CodePreviewDialog = ({
  open,
  onOpenChange,
  code,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  code: string;
}) => {
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };
  const download = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "GeneratedPage.tsx";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center justify-between border-b hairline px-6 py-4 space-y-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Output</p>
            <DialogTitle className="font-display text-2xl">Generated React + Tailwind</DialogTitle>
          </div>
          <div className="flex gap-2 pr-8">
            <Button variant="ghost" size="sm" onClick={copy}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</Button>
            <Button size="sm" onClick={download} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Download className="mr-1.5 h-3.5 w-3.5" />Download
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto bg-rail/30 p-6">
          <pre className="font-mono text-xs leading-relaxed text-foreground/90">
            <code>{code}</code>
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};
