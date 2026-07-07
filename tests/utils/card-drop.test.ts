import { describe, expect, it } from 'vitest';
import { dropTargetIndex, insertionIndex, type Rect } from '@/utils/card-drop';

/** A card rect on a 3-column grid of 100×100 cells (no gap) at `(col, row)`. */
function cell(col: number, row: number, cols = 1): Rect {
  const left = col * 100;
  const top = row * 100;
  return { left, top, right: left + cols * 100, bottom: top + 100 };
}

describe('insertionIndex', () => {
  // Four 1-col cards: row 0 has three, row 1 has one (two empty cells trail it).
  const rects = [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1)];

  it('inserts at the start when the pointer is above/left of everything', () => {
    expect(insertionIndex({ x: 10, y: 10 }, rects)).toBe(0);
  });

  it('inserts before a card when the pointer is on its left half', () => {
    expect(insertionIndex({ x: 110, y: 50 }, rects)).toBe(1);
  });

  it('inserts at the end for an empty cell trailing the last row', () => {
    // Pointer over the empty cell at (col 2, row 1).
    expect(insertionIndex({ x: 250, y: 150 }, rects)).toBe(4);
  });
});

describe('dropTargetIndex', () => {
  const rects = [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1)];

  it('moves a card into the empty cell at the end of a partial row', () => {
    // Drag card 0 to the empty cell after card 3 → lands last.
    expect(dropTargetIndex({ x: 250, y: 150 }, rects, 0)).toBe(3);
  });

  it('moves a card to the front', () => {
    expect(dropTargetIndex({ x: 10, y: 10 }, rects, 3)).toBe(0);
  });

  it('is a no-op when the pointer resolves to the card’s own slot', () => {
    expect(dropTargetIndex({ x: 110, y: 50 }, rects, 1)).toBe(-1);
  });

  it('is a no-op for an out-of-range source index', () => {
    expect(dropTargetIndex({ x: 250, y: 150 }, rects, 9)).toBe(-1);
  });

  it('drops a 1-col card into the gap a wrapped 3-col card leaves', () => {
    // Layout: [2-col, 1-col, 2-col, 3-col]; the 2nd 2-col card wraps to row 1,
    // leaving an empty cell at (col 2, row 1) before the full-width card.
    const layout = [cell(0, 0, 2), cell(2, 0), cell(0, 1, 2), cell(0, 2, 3)];
    // Drag the 1-col card (index 1) into that empty cell.
    expect(dropTargetIndex({ x: 250, y: 150 }, layout, 1)).toBe(2);
  });
});
