export type NodeType = "box" | "text" | "image" | "button" | "input";
export type Breakpoint = "mobile" | "tablet" | "desktop";

export interface CanvasNode {
  id: string;
  pageId: string;
  type: NodeType;
  /** Position is relative to the parent page frame (top-left of the frame's content area). */
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: {
    background?: string;
    color?: string;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    padding?: number;
    fontSize?: number;
    fontWeight?: number;
    display?: "flex" | "block";
    flexDirection?: "row" | "column";
    alignItems?: "start" | "center" | "end";
    justifyContent?: "start" | "center" | "end" | "between";
  };
  content?: string;
  /** When set, this node is an instance of a master component. Master edits propagate. */
  componentId?: string;
  /** For image nodes — data URL or remote URL. */
  src?: string;
  zIndex: number;
  /** Lock from editing on canvas. */
  locked?: boolean;
  /** Hide from canvas. */
  hidden?: boolean;
}

export interface Page {
  id: string;
  name: string;
  /** Top-left of the page frame on the infinite canvas. */
  position: { x: number; y: number };
  size: { width: number; height: number };
  background?: string;
  /** Responsive breakpoint of this page frame. */
  breakpoint?: Breakpoint;
}

/** A directed flow connection from one page to another. */
export interface Edge {
  id: string;
  fromPageId: string;
  fromNodeId?: string;
  toPageId: string;
  label?: string;
}

/** Reusable master component — instances reference its id via node.componentId. */
export interface ComponentMaster {
  id: string;
  name: string;
  /** Snapshot of nodes (positions are relative to the component's own bounding box). */
  nodes: Omit<CanvasNode, "pageId" | "id">[];
  size: { width: number; height: number };
  /** Optional thumbnail data URL. */
  thumbnail?: string;
  createdAt: number;
}

export interface AssetItem {
  id: string;
  name: string;
  /** Data URL for the file (kept in localStorage). */
  dataUrl: string;
  kind: "image";
  createdAt: number;
}

export interface DesignTokens {
  colors: {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    border: string;
    surface: string;
  };
  typography: {
    displayFamily: string;
    bodyFamily: string;
    scale: number; // base px
  };
  spacing: number; // base unit (4 / 8)
  radius: number;
  theme: "light" | "dark";
}

export interface PromptHistoryItem {
  id: string;
  prompt: string;
  kind: "wireframe" | "page" | "inline" | "critic" | "image" | "vision";
  createdAt: number;
  favorite?: boolean;
}

export interface Scene {
  pages: Page[];
  nodes: CanvasNode[];
  edges: Edge[];
  components: ComponentMaster[];
  assets: AssetItem[];
  tokens: DesignTokens;
  promptHistory: PromptHistoryItem[];
}

export const BREAKPOINT_SIZE: Record<Breakpoint, { width: number; height: number }> = {
  mobile: { width: 390, height: 780 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

export const defaultTokens = (): DesignTokens => ({
  colors: {
    background: "#0f0d0b",
    foreground: "#f3ecdc",
    muted: "#9b9588",
    accent: "#d49a3e",
    border: "#2a2622",
    surface: "#1a1714",
  },
  typography: {
    displayFamily: "Instrument Serif, serif",
    bodyFamily: "Inter, system-ui, sans-serif",
    scale: 16,
  },
  spacing: 8,
  radius: 8,
  theme: "dark",
});

export const defaultStyleFor = (type: NodeType, tokens?: DesignTokens): CanvasNode["style"] => {
  const t = tokens ?? defaultTokens();
  switch (type) {
    case "text":
      return { color: t.colors.foreground, fontSize: t.typography.scale, fontWeight: 400 };
    case "button":
      return {
        background: t.colors.accent,
        color: t.colors.background,
        borderRadius: t.radius,
        padding: t.spacing * 1.5,
        fontSize: 14,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      };
    case "input":
      return {
        background: t.colors.surface,
        color: t.colors.foreground,
        borderRadius: Math.max(4, t.radius - 2),
        borderWidth: 1,
        borderColor: t.colors.border,
        padding: t.spacing * 1.25,
        fontSize: 14,
      };
    case "image":
      return { background: t.colors.surface, borderRadius: t.radius };
    case "box":
    default:
      return {
        background: t.colors.surface,
        borderRadius: t.radius * 1.5,
        borderWidth: 1,
        borderColor: t.colors.border,
      };
  }
};

export const defaultContentFor = (type: NodeType): string | undefined => {
  switch (type) {
    case "text":
      return "Text element";
    case "button":
      return "Button";
    case "input":
      return "Placeholder…";
    default:
      return undefined;
  }
};

export const defaultSizeFor = (type: NodeType) => {
  switch (type) {
    case "text":
      return { width: 180, height: 28 };
    case "button":
      return { width: 140, height: 44 };
    case "input":
      return { width: 220, height: 40 };
    case "image":
      return { width: 220, height: 160 };
    default:
      return { width: 280, height: 180 };
  }
};

export const defaultPageSize = { width: 420, height: 720 };

export const newPage = (
  name: string,
  x: number,
  y: number,
  breakpoint: Breakpoint = "mobile",
  background = "#0f0d0b",
): Page => ({
  id: `p_${Math.random().toString(36).slice(2, 8)}`,
  name,
  position: { x, y },
  size: { ...BREAKPOINT_SIZE[breakpoint] },
  background,
  breakpoint,
});

export const uid = (prefix = "n") => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
