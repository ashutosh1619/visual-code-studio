import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Eye, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createShareLink,
  loadShareLinks,
  revokeShareLink,
  shareUrlFor,
  getOrCreateLocalPeer,
  setLocalPeerName,
  type ShareLink,
} from "@/lib/collab";
import { toast } from "sonner";

export const SharePopover = ({
  open,
  onOpenChange,
  peerCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  peerCount: number;
}) => {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [name, setName] = useState(getOrCreateLocalPeer().name);

  useEffect(() => {
    if (open) setLinks(loadShareLinks());
  }, [open]);

  const handleCreate = (mode: "view" | "edit") => {
    const link = createShareLink(mode);
    setLinks((l) => [...l, link]);
    navigator.clipboard.writeText(shareUrlFor(link)).catch(() => {});
    toast.success(`${mode === "edit" ? "Edit" : "View"} link copied`);
  };

  const handleCopy = (link: ShareLink) => {
    navigator.clipboard.writeText(shareUrlFor(link)).catch(() => {});
    toast.success("Link copied");
  };

  const handleRevoke = (token: string) => {
    revokeShareLink(token);
    setLinks(loadShareLinks());
    toast.success("Link revoked");
  };

  const handleNameBlur = () => {
    setLocalPeerName(name.trim() || "Anonymous");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b hairline px-6 py-4 space-y-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Collaborate</p>
          <DialogTitle className="font-display text-2xl">Share this canvas</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="flex items-center justify-between rounded-md border hairline bg-rail/40 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-accent" />
              <span>
                {peerCount === 0
                  ? "You are the only one here"
                  : `${peerCount + 1} ${peerCount + 1 === 1 ? "person" : "people"} on this canvas`}
              </span>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Your display name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Create a link
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9"
                onClick={() => handleCreate("view")}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" /> View only
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => handleCreate("edit")}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Can edit
              </Button>
            </div>
          </div>

          {links.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Active links
              </p>
              <div className="space-y-1.5">
                {links.map((link) => (
                  <div
                    key={link.token}
                    className="flex items-center gap-2 rounded-md border hairline bg-rail/30 px-2.5 py-1.5"
                  >
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                        link.mode === "edit"
                          ? "bg-accent/15 text-accent"
                          : "bg-muted-foreground/10 text-muted-foreground",
                      )}
                    >
                      {link.mode}
                    </span>
                    <code className="flex-1 truncate font-mono text-[10px] text-muted-foreground">
                      …{link.token.slice(-12)}
                    </code>
                    <button
                      onClick={() => handleCopy(link)}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      title="Copy link"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleRevoke(link.token)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                      title="Revoke"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-muted-foreground/70">
            Share links work locally across browser tabs today. When you connect Lovable Cloud, the
            same links route through realtime sync so collaborators on other devices join
            automatically.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
