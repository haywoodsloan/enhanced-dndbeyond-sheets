/**
 * Pointer-geometry helpers for dropping a card into an arbitrary grid slot —
 * including the empty cells a partial row leaves behind, which SortableJS can't
 * target on its own (it only swaps with a sibling element under the pointer).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Reading-order insertion index in `[0, rects.length]` for a pointer over a grid
 * of card rects (in visual/document order). The result is the position the card
 * would occupy: a card is "before" the pointer when it sits on an earlier row,
 * or on the same row left of the pointer; the index is the first card that comes
 * after the pointer, or the end when the pointer trails every card (e.g. the
 * empty cells at the end of a partial row).
 */
export function insertionIndex(pointer: Point, rects: Rect[]): number {
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    const aboveRow = pointer.y < rect.top;
    const inRow = pointer.y >= rect.top && pointer.y <= rect.bottom;
    const beforeInRow = inRow && pointer.x < rect.left + (rect.right - rect.left) / 2;
    if (aboveRow || beforeInRow) return i;
  }
  return rects.length;
}

/**
 * Destination index for moving the card at `fromIndex` to wherever `pointer` was
 * released over `rects` (card rects in current order). Returns `-1` for a no-op
 * — the pointer resolves back to the card's own slot, or the index is out of
 * range. Removing the card before re-inserting shifts later targets down by one,
 * which is folded in here so the result feeds `moveSectionByIndex` directly.
 */
export function dropTargetIndex(pointer: Point, rects: Rect[], fromIndex: number): number {
  const count = rects.length;
  if (fromIndex < 0 || fromIndex >= count) return -1;

  const insert = insertionIndex(pointer, rects);
  let to = insert > fromIndex ? insert - 1 : insert;
  if (to < 0) to = 0;
  if (to > count - 1) to = count - 1;
  return to === fromIndex ? -1 : to;
}
