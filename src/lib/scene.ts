export type NodeType = "box" | "text" | "image" | "button" | "input";

export interface CanvasNode {
  id: string;
  type: NodeType;
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
  zIndex: number;
}

export const defaultStyleFor = (type: NodeType): CanvasNode["style"] => {
  switch (type) {
    case "text":
      return { color: "#e9e4d8", fontSize: 16, fontWeight: 400 };
    case "button":
      return {
        background: "#d49a3e",
        color: "#1a1714",
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      };
    case "input":
      return {
        background: "#1f1c19",
        color: "#e9e4d8",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#3a342e",
        padding: 10,
        fontSize: 14,
      };
    case "image":
      return { background: "#2a2622", borderRadius: 8 };
    case "box":
    default:
      return {
        background: "#1a1714",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#2a2622",
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
