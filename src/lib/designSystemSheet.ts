// Generate a "Design System" sheet — Page 0 of the storyboard — directly
// from the current design tokens. Mirrors the left column of the reference
// wireframe (Colors, Typography, Buttons, Chips, Spacing).
//
// We layout deterministically (no AI call) so the sheet is always perfectly
// aligned and stays in sync with the active theme.

import type { CanvasNode, Page, Fidelity } from "./scene";
import { defaultStyleFor } from "./scene";
import type { DesignTokens } from "./tokens";
import { textRoleSize } from "./tokens";

const uid = () => `n_${Math.random().toString(36).slice(2, 8)}`;

const SHEET_W = 320;
const SHEET_H = 1180;
const PAD = 32;

export const createDesignSystemPage = (): Page => ({
  id: `p_ds_${Math.random().toString(36).slice(2, 6)}`,
  name: "Design System",
  number: 0,
  position: { x: 120, y: 120 },
  size: { width: SHEET_W, height: SHEET_H },
  background: "#ffffff",
  kind: "design-system",
});

export const buildDesignSystemNodes = (
  page: Page,
  tokens: DesignTokens,
  fidelity: Fidelity = "wireframe",
  projectName: string = "Untitled Project",
): CanvasNode[] => {
  const nodes: CanvasNode[] = [];
  let z = 1;

  const text = (
    content: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { size?: number; weight?: number; color?: string } = {},
  ) => {
    nodes.push({
      id: uid(),
      pageId: page.id,
      type: "text",
      position: { x, y },
      size: { width: w, height: h },
      style: {
        color: opts.color ?? tokens.colors.text,
        fontSize: opts.size ?? tokens.type.base,
        fontWeight: opts.weight ?? 400,
      },
      content,
      zIndex: z++,
      fidelity,
    });
  };

  const swatch = (color: string, x: number, y: number, w: number, h: number) => {
    nodes.push({
      id: uid(),
      pageId: page.id,
      type: "box",
      position: { x, y },
      size: { width: w, height: h },
      style: {
        background: color,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: tokens.colors.border,
      },
      zIndex: z++,
      fidelity,
    });
  };

  // ---- Header ----
  text(projectName, PAD, 32, 240, 28, { size: 22, weight: 700 });
  text("Wireframes & Design System", PAD, 60, 240, 22, { size: 14, weight: 500, color: tokens.colors.textMuted });

  // ---- 01. Design System divider ----
  text("01. Design System", PAD, 100, 240, 18, {
    size: 12,
    weight: 600,
    color: tokens.colors.accent,
  });

  // ---- Colors ----
  text("Colors", PAD, 140, 100, 18, { size: 13, weight: 600, color: tokens.colors.accent });

  const colorRow = [
    { name: "Primary", value: tokens.colors.accent },
    { name: "Hover", value: shade(tokens.colors.accent, -0.15) },
    { name: "Accent Yellow", value: "#FFC300" },
  ];
  const colorRow2 = [
    { name: "Background", value: tokens.colors.background },
    { name: "Surface", value: tokens.colors.surface },
    { name: "Border", value: tokens.colors.border },
  ];
  const colorRow3 = [
    { name: "Text Primary", value: tokens.colors.text },
    { name: "Text Muted", value: tokens.colors.textMuted },
    { name: "Success", value: "#16A34A" },
  ];

  const swW = 64;
  const swH = 56;
  const colGap = 12;
  const colsX = (i: number) => PAD + i * (swW + colGap);

  let y = 168;
  for (const row of [colorRow, colorRow2, colorRow3]) {
    row.forEach((c, i) => {
      swatch(c.value, colsX(i), y, swW, swH);
      text(c.name, colsX(i), y + swH + 6, swW + 20, 12, {
        size: 9,
        weight: 500,
        color: tokens.colors.text,
      });
      text(c.value.toUpperCase(), colsX(i), y + swH + 18, swW + 20, 10, {
        size: 8,
        color: tokens.colors.textMuted,
      });
    });
    y += swH + 44;
  }

  // ---- Typography ----
  y += 8;
  text("Typography", PAD, y, 120, 18, { size: 13, weight: 600, color: tokens.colors.accent });
  y += 22;

  const typeSpecs = [
    { label: "H1", desc: `${textRoleSize("h1", tokens)}px Bold`, size: textRoleSize("h1", tokens), weight: 700 },
    { label: "H2", desc: `${textRoleSize("h2", tokens)}px SemiBold`, size: textRoleSize("h2", tokens), weight: 600 },
    { label: "Body", desc: `${tokens.type.base}px Regular`, size: tokens.type.base, weight: 400 },
    { label: "Small", desc: `${textRoleSize("caption", tokens)}px Regular`, size: textRoleSize("caption", tokens), weight: 400 },
  ];
  for (const t of typeSpecs) {
    text(t.label, PAD, y, 60, 24, { size: t.size, weight: t.weight });
    text(t.desc, PAD + 80, y + (t.size > 16 ? 6 : 2), 200, 16, {
      size: 11,
      color: tokens.colors.textMuted,
    });
    y += Math.max(28, t.size + 12);
  }

  // ---- Buttons ----
  y += 12;
  text("Buttons", PAD, y, 120, 18, { size: 13, weight: 600, color: tokens.colors.accent });
  y += 22;
  text("Primary Button", PAD, y, 140, 12, { size: 9, color: tokens.colors.textMuted });
  text("Secondary Button", PAD + 130, y, 140, 12, { size: 9, color: tokens.colors.textMuted });
  y += 16;

  // primary
  nodes.push({
    id: uid(),
    pageId: page.id,
    type: "button",
    position: { x: PAD, y },
    size: { width: 110, height: 40 },
    style: {
      background: tokens.colors.accent,
      color: tokens.colors.accentText,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    content: "Button",
    zIndex: z++,
    fidelity,
  });
  text("48px Height", PAD + 8, y + 44, 110, 12, {
    size: 9,
    color: tokens.colors.textMuted,
  });
  // secondary
  nodes.push({
    id: uid(),
    pageId: page.id,
    type: "button",
    position: { x: PAD + 130, y },
    size: { width: 110, height: 36 },
    style: {
      background: "#ffffff",
      color: tokens.colors.text,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      fontSize: 12,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    content: "Button",
    zIndex: z++,
    fidelity,
  });
  text("40px Height", PAD + 138, y + 40, 110, 12, {
    size: 9,
    color: tokens.colors.textMuted,
  });

  y += 76;
  text("Icon Button", PAD, y, 120, 12, { size: 9, color: tokens.colors.textMuted });
  y += 14;
  nodes.push({
    id: uid(),
    pageId: page.id,
    type: "icon-circle",
    position: { x: PAD, y },
    size: { width: 36, height: 36 },
    style: defaultStyleFor("icon-circle", fidelity),
    content: "♥",
    zIndex: z++,
    fidelity,
  });
  text("36 x 36px", PAD + 44, y + 12, 100, 12, { size: 10, color: tokens.colors.textMuted });

  // ---- Chips ----
  y += 60;
  text("Chips / Filters", PAD, y, 160, 18, { size: 13, weight: 600, color: tokens.colors.accent });
  y += 22;
  const chipLabels = ["Filter Chip", "Filter Chip", "Filter Chip"];
  const chipStates = ["Default", "Selected", "Hover"];
  let cx = PAD;
  chipLabels.forEach((label, i) => {
    const isActive = i === 1;
    nodes.push({
      id: uid(),
      pageId: page.id,
      type: "chip",
      position: { x: cx, y },
      size: { width: 80, height: 28 },
      style: {
        ...defaultStyleFor("chip", fidelity),
        background: isActive ? tokens.colors.accent : "#ffffff",
        color: isActive ? tokens.colors.accentText : tokens.colors.text,
        borderColor: isActive ? tokens.colors.accent : tokens.colors.border,
      },
      content: label,
      zIndex: z++,
      fidelity,
    });
    text(chipStates[i], cx, y + 32, 90, 10, { size: 8, color: tokens.colors.textMuted });
    cx += 88;
  });

  // ---- Spacing scale ----
  y += 64;
  text("Spacing (8px System)", PAD, y, 200, 18, {
    size: 13,
    weight: 600,
    color: tokens.colors.accent,
  });
  y += 22;
  const sp = [8, 16, 24, 32, 48, 64];
  let sx = PAD;
  for (const s of sp) {
    swatch(tokens.colors.accent, sx, y + (64 - s), s, s);
    text(String(s), sx, y + 70, s + 12, 10, { size: 9, color: tokens.colors.textMuted });
    sx += s + 8;
  }

  return nodes;
};

// Util — shade a hex color by amount in [-1..1].
function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const num = parseInt(h, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amt)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amt)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * amt)));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}
