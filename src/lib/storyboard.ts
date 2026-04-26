// Tile pages in a storyboard grid (rows of N) with numbered labels.
// This mirrors the reference wireframe sheet — every page laid out at once,
// with consistent gutters and a left column reserved for the design-system
// sheet when present.

import type { Page } from "./scene";

export interface StoryboardOptions {
  /** Pages per row in the storyboard. */
  cols?: number;
  /** Outer gutter around the storyboard. */
  margin?: number;
  /** Gap between page frames. */
  gap?: number;
}

/**
 * Re-position every page so they tile into a clean grid. Page 0 is always
 * the design-system sheet (if one exists) and is placed in a tall left column;
 * the remaining pages tile in rows to its right.
 */
export const tileStoryboard = (
  pages: Page[],
  opts: StoryboardOptions = {},
): Page[] => {
  const cols = opts.cols ?? 4;
  const margin = opts.margin ?? 120;
  const gap = opts.gap ?? 60;

  const ds = pages.find((p) => p.kind === "design-system");
  const screens = pages.filter((p) => p.kind !== "design-system");

  const result: Page[] = [];
  let originX = margin;
  const originY = margin;

  // Position the design-system sheet first if present.
  if (ds) {
    result.push({
      ...ds,
      number: 0,
      position: { x: originX, y: originY },
    });
    originX += ds.size.width + gap;
  }

  // Tile screens row by row.
  const rowHeights: number[] = [];
  screens.forEach((page, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (col === 0 && row >= rowHeights.length) {
      const prev = rowHeights[row - 1] ?? 0;
      const before = rowHeights.slice(0, row).reduce((s, h) => s + h + gap, 0);
      rowHeights.push(page.size.height);
    } else if (col !== 0) {
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, page.size.height);
    } else {
      rowHeights[row] = page.size.height;
    }
  });

  // Cumulative row offsets.
  const rowYOffsets: number[] = [0];
  for (let r = 1; r < rowHeights.length; r++) {
    rowYOffsets[r] = rowYOffsets[r - 1] + rowHeights[r - 1] + gap;
  }

  screens.forEach((page, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = originX + col * (page.size.width + gap);
    const y = originY + rowYOffsets[row];
    result.push({
      ...page,
      number: i + 1,
      position: { x, y },
    });
  });

  return result;
};
