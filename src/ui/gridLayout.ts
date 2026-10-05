export interface GridItem {
  id: string;
  col?: number;
  row?: number;
  w: number;
  h: number;
}

export interface Cell {
  col: number;
  row: number;
}

/**
 * Places widgets on a grid of `cols` columns. Items with a saved position keep it unless they collide, in which
 * case they are pushed down. `fixedId` (the widget the user just moved or resized) is placed first and wins.
 * Items without a position are put in the first free spot, scanning left to right, top to bottom.
 */
export function placeAll(items: GridItem[], cols: number, fixedId?: string): Record<string, Cell> {
  const used = new Set<string>();
  const out: Record<string, Cell> = {};
  const free = (c: number, r: number, w: number, h: number) => {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (used.has(`${x},${y}`)) return false;
    return true;
  };
  const take = (it: GridItem, c: number, r: number) => {
    for (let y = r; y < r + it.h; y++) for (let x = c; x < c + it.w; x++) used.add(`${x},${y}`);
    out[it.id] = { col: c, row: r };
  };
  const clampCol = (it: GridItem, c: number) => Math.max(0, Math.min(cols - it.w, c));

  const fixed = items.find((i) => i.id === fixedId);
  if (fixed) take(fixed, clampCol(fixed, fixed.col ?? 0), Math.max(0, fixed.row ?? 0));

  const rest = items
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => it !== fixed)
    .sort((a, b) => (a.it.row ?? Infinity) - (b.it.row ?? Infinity) || (a.it.col ?? 0) - (b.it.col ?? 0) || a.index - b.index);

  for (const { it } of rest) {
    if (it.row !== undefined && it.col !== undefined) {
      const c = clampCol(it, it.col);
      let r = Math.max(0, it.row);
      while (!free(c, r, it.w, it.h)) r++;
      take(it, c, r);
    } else {
      let placed = false;
      for (let r = 0; !placed; r++) {
        for (let c = 0; c + it.w <= cols; c++) {
          if (free(c, r, it.w, it.h)) {
            take(it, c, r);
            placed = true;
            break;
          }
        }
      }
    }
  }
  return out;
}
