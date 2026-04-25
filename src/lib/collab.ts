// Lightweight collaboration primitives — presence + comments + share links.
// MVP: state lives in localStorage + BroadcastChannel so multi-tab feels live
// without needing a backend. Swap to Lovable Cloud Realtime later by replacing
// the transport in `useChannel` while keeping the same shape.

export interface PresencePeer {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  /** epoch ms — peers are pruned after ~5s of silence */
  lastSeen: number;
}

export interface Comment {
  id: string;
  pageId: string;
  /** position relative to the page frame's top-left */
  position: { x: number; y: number };
  author: string;
  authorColor: string;
  body: string;
  createdAt: number;
  resolved?: boolean;
}

export interface ShareLink {
  /** opaque url-safe token */
  token: string;
  mode: "view" | "edit";
  createdAt: number;
}

const PALETTE = [
  "#d49a3e",
  "#7aa2a8",
  "#c97a6c",
  "#a39068",
  "#8a7fb0",
  "#6f9b6e",
];

const ANIMALS = [
  "Otter", "Heron", "Fox", "Lynx", "Wren", "Marten", "Crane", "Roe", "Hare", "Ibis",
];

const STORAGE_PRESENCE_ID = "devcanvas:peerId";
const STORAGE_PRESENCE_NAME = "devcanvas:peerName";
const STORAGE_COMMENTS = "devcanvas:comments";
const STORAGE_SHARE = "devcanvas:share";

const pickFrom = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export const getOrCreateLocalPeer = (): { id: string; name: string; color: string } => {
  let id = localStorage.getItem(STORAGE_PRESENCE_ID);
  if (!id) {
    id = `peer_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(STORAGE_PRESENCE_ID, id);
  }
  let name = localStorage.getItem(STORAGE_PRESENCE_NAME);
  if (!name) {
    name = `${pickFrom(ANIMALS)} ${Math.floor(Math.random() * 90 + 10)}`;
    localStorage.setItem(STORAGE_PRESENCE_NAME, name);
  }
  // color is derived from the id so it is stable across sessions
  const hash = Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0);
  const color = PALETTE[hash % PALETTE.length];
  return { id, name, color };
};

export const setLocalPeerName = (name: string) => {
  localStorage.setItem(STORAGE_PRESENCE_NAME, name);
};

// ---------- Presence channel ----------

export type PresenceMessage =
  | { type: "cursor"; peer: PresencePeer }
  | { type: "leave"; id: string };

export class PresenceChannel {
  private bc: BroadcastChannel | null = null;
  private listeners = new Set<(msg: PresenceMessage) => void>();

  constructor(roomId: string) {
    if (typeof BroadcastChannel !== "undefined") {
      this.bc = new BroadcastChannel(`devcanvas:presence:${roomId}`);
      this.bc.onmessage = (e) => this.listeners.forEach((l) => l(e.data));
    }
  }

  send(msg: PresenceMessage) {
    this.bc?.postMessage(msg);
  }

  subscribe(fn: (msg: PresenceMessage) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close() {
    this.bc?.close();
    this.listeners.clear();
  }
}

// ---------- Comments ----------

export const loadComments = (): Comment[] => {
  try {
    const raw = localStorage.getItem(STORAGE_COMMENTS);
    return raw ? (JSON.parse(raw) as Comment[]) : [];
  } catch {
    return [];
  }
};

export const saveComments = (comments: Comment[]) => {
  localStorage.setItem(STORAGE_COMMENTS, JSON.stringify(comments));
};

// ---------- Share links ----------

const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const loadShareLinks = (): ShareLink[] => {
  try {
    const raw = localStorage.getItem(STORAGE_SHARE);
    return raw ? (JSON.parse(raw) as ShareLink[]) : [];
  } catch {
    return [];
  }
};

export const saveShareLinks = (links: ShareLink[]) => {
  localStorage.setItem(STORAGE_SHARE, JSON.stringify(links));
};

export const createShareLink = (mode: "view" | "edit"): ShareLink => {
  const link: ShareLink = { token: randomToken(), mode, createdAt: Date.now() };
  const next = [...loadShareLinks(), link];
  saveShareLinks(next);
  return link;
};

export const revokeShareLink = (token: string) => {
  saveShareLinks(loadShareLinks().filter((l) => l.token !== token));
};

export const shareUrlFor = (link: ShareLink): string => {
  const url = new URL(window.location.href);
  url.searchParams.set("share", link.token);
  url.searchParams.set("mode", link.mode);
  return url.toString();
};
