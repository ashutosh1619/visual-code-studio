// Snapping helpers — find nearby alignment guides for a moving rect against
// every other rect on the same page. Returns the snapped delta and the guides
// to render.

export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

export interface Guide {
  /** Vertical guide → x position; horizontal guide → y position */
  axis: "x" | "y";
  position: number;
  start: number;
  end: number;
}

const SNAP_THRESHOLD = 6;

/**
 * Compute snap adjustments for `moving` against `others`.
 * Coordinates are in canvas-space (after page offset is applied).
 */
export const snapRect = (moving: Rect, others: Rect[]): SnapResult => {
  let bestDx = 0;
  let bestDxDist = Infinity;
  let bestDy = 0;
  let bestDyDist = Infinity;
  const guides: Guide[] = [];

  const movX = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const movY = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];

  for (const o of others) {
    if (o.id === moving.id) continue;
    const oX = [o.x, o.x + o.w / 2, o.x + o.w];
    const oY = [o.y, o.y + o.h / 2, o.y + o.h];

    for (const a of movX) {
      for (const b of oX) {
        const d = b - a;
        if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < bestDxDist) {
          bestDx = d;
          bestDxDist = Math.abs(d);
        }
      }
    }
    for (const a of movY) {
      for (const b of oY) {
        const d = b - a;
        if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < bestDyDist) {
          bestDy = d;
          bestDyDist = Math.abs(d);
        }
      }
    }
  }

  // Build guide lines for whichever snap actually applied
  const adjMov = {
    ...moving,
    x: moving.x + bestDx,
    y: moving.y + bestDy,
  };
  const adjMovX = [adjMov.x, adjMov.x + adjMov.w / 2, adjMov.x + adjMov.w];
  const adjMovY = [adjMov.y, adjMov.y + adjMov.h / 2, adjMov.y + adjMov.h];

  for (const o of others) {
    if (o.id === moving.id) continue;
    const oXs = [o.x, o.x + o.w / 2, o.x + o.w];
    const oYs = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const x of adjMovX) {
      for (const ox of oXs) {
        if (Math.abs(x - ox) < 0.5) {
          guides.push({
            axis: "x",
            position: x,
            start: Math.min(adjMov.y, o.y),
            end: Math.max(adjMov.y + adjMov.h, o.y + o.h),
          });
        }
      }
    }
    for (const y of adjMovY) {
      for (const oy of oYs) {
        if (Math.abs(y - oy) < 0.5) {
          guides.push({
            axis: "y",
            position: y,
            start: Math.min(adjMov.x, o.x),
            end: Math.max(adjMov.x + adjMov.w, o.x + o.w),
          });
        }
      }
    }
  }

  return { dx: bestDx, dy: bestDy, guides };
};
