import { useEffect, useRef, useState } from "react";
import { MousePointer2, MessageSquare, Check, X } from "lucide-react";
import {
  PresenceChannel,
  getOrCreateLocalPeer,
  type Comment,
  type PresencePeer,
} from "@/lib/collab";
import type { Page } from "@/lib/scene";
import { cn } from "@/lib/utils";

interface Props {
  roomId: string;
  zoom: number;
  cursor: { x: number; y: number };
  pages: Page[];
  comments: Comment[];
  commentMode: boolean;
  onAddComment: (c: Omit<Comment, "id" | "createdAt">) => void;
  onResolveComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
}

export const CollabLayer = ({
  roomId,
  zoom,
  cursor,
  pages,
  comments,
  commentMode,
  onAddComment,
  onResolveComment,
  onDeleteComment,
}: Props) => {
  const me = useRef(getOrCreateLocalPeer());
  const [peers, setPeers] = useState<Record<string, PresencePeer>>({});
  const [draft, setDraft] = useState<{ pageId: string; x: number; y: number } | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const channelRef = useRef<PresenceChannel | null>(null);

  // Establish presence channel
  useEffect(() => {
    const ch = new PresenceChannel(roomId);
    channelRef.current = ch;
    const unsub = ch.subscribe((msg) => {
      if (msg.type === "cursor") {
        if (msg.peer.id === me.current.id) return;
        setPeers((prev) => ({ ...prev, [msg.peer.id]: msg.peer }));
      } else if (msg.type === "leave") {
        setPeers((prev) => {
          const next = { ...prev };
          delete next[msg.id];
          return next;
        });
      }
    });
    const onUnload = () => ch.send({ type: "leave", id: me.current.id });
    window.addEventListener("beforeunload", onUnload);
    return () => {
      onUnload();
      unsub();
      ch.close();
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [roomId]);

  // Broadcast our cursor (throttled to ~30fps)
  const lastSent = useRef(0);
  useEffect(() => {
    const now = performance.now();
    if (now - lastSent.current < 33) return;
    lastSent.current = now;
    channelRef.current?.send({
      type: "cursor",
      peer: { ...me.current, cursor, lastSeen: Date.now() },
    });
  }, [cursor]);

  // Prune stale peers every 2s
  useEffect(() => {
    const t = setInterval(() => {
      setPeers((prev) => {
        const cutoff = Date.now() - 5000;
        const next: Record<string, PresencePeer> = {};
        for (const [id, p] of Object.entries(prev)) if (p.lastSeen > cutoff) next[id] = p;
        return next;
      });
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // Click-to-place a comment when comment mode is on
  const handleSurfaceClick = (e: React.MouseEvent) => {
    if (!commentMode) return;
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const page = pages.find(
      (p) =>
        x >= p.position.x &&
        x <= p.position.x + p.size.width &&
        y >= p.position.y &&
        y <= p.position.y + p.size.height,
    );
    if (!page) return;
    setDraft({ pageId: page.id, x: x - page.position.x, y: y - page.position.y });
    setDraftBody("");
  };

  const submitDraft = () => {
    if (!draft || !draftBody.trim()) {
      setDraft(null);
      return;
    }
    onAddComment({
      pageId: draft.pageId,
      position: { x: draft.x, y: draft.y },
      author: me.current.name,
      authorColor: me.current.color,
      body: draftBody.trim(),
    });
    setDraft(null);
    setDraftBody("");
  };

  const pageById = new Map(pages.map((p) => [p.id, p]));
  const visibleComments = comments.filter((c) => !c.resolved);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0",
        commentMode && "pointer-events-auto cursor-crosshair",
      )}
      onClick={handleSurfaceClick}
    >
      {/* Inner zoomed plane to match the canvas transform */}
      <div
        className="relative h-full w-full"
        style={{ transform: `scale(${zoom})`, transformOrigin: "0 0", width: 8000, height: 5000 }}
      >
        {/* Phantom cursors */}
        {Object.values(peers).map((p) =>
          p.cursor ? (
            <div
              key={p.id}
              className="pointer-events-none absolute -translate-x-0.5 -translate-y-0.5 transition-transform"
              style={{ left: p.cursor.x, top: p.cursor.y }}
            >
              <MousePointer2
                className="h-4 w-4 drop-shadow"
                style={{ color: p.color, fill: p.color }}
              />
              <span
                className="ml-3 mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] text-background"
                style={{ background: p.color }}
              >
                {p.name}
              </span>
            </div>
          ) : null,
        )}

        {/* Comment pins */}
        {visibleComments.map((c) => {
          const page = pageById.get(c.pageId);
          if (!page) return null;
          const x = page.position.x + c.position.x;
          const y = page.position.y + c.position.y;
          const isOpen = openId === c.id;
          return (
            <div
              key={c.id}
              className="pointer-events-auto absolute"
              style={{ left: x, top: y, zIndex: 9999 }}
              onClick={(e) => {
                e.stopPropagation();
                setOpenId((cur) => (cur === c.id ? null : c.id));
              }}
            >
              <div
                className="flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-background shadow-md transition-transform hover:scale-110"
                style={{ background: c.authorColor }}
                title={`${c.author}: ${c.body}`}
              >
                <MessageSquare className="h-3 w-3 text-background" />
              </div>
              {isOpen && (
                <div
                  className="absolute left-3 top-3 w-56 rounded-md border hairline bg-background/95 p-3 text-foreground shadow-xl backdrop-blur"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: c.authorColor }}
                    >
                      {c.author}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          onResolveComment(c.id);
                          setOpenId(null);
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                        title="Resolve"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          onDeleteComment(c.id);
                          setOpenId(null);
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90">{c.body}</p>
                </div>
              )}
            </div>
          );
        })}

        {/* Draft comment popover */}
        {draft && (() => {
          const page = pageById.get(draft.pageId);
          if (!page) return null;
          const x = page.position.x + draft.x;
          const y = page.position.y + draft.y;
          return (
            <div
              className="pointer-events-auto absolute"
              style={{ left: x, top: y, zIndex: 10000 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background shadow-md"
                style={{ background: me.current.color }}
              />
              <div className="absolute left-3 top-3 w-60 rounded-md border hairline bg-background/95 p-2 shadow-xl backdrop-blur">
                <textarea
                  autoFocus
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitDraft();
                    }
                    if (e.key === "Escape") {
                      setDraft(null);
                    }
                  }}
                  placeholder="Leave a note…"
                  className="w-full resize-none bg-transparent p-1 text-xs outline-none placeholder:text-muted-foreground/60"
                  rows={2}
                />
                <div className="mt-1 flex justify-end gap-1">
                  <button
                    onClick={() => setDraft(null)}
                    className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDraft}
                    className="rounded bg-accent px-2 py-0.5 text-[10px] text-accent-foreground"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
