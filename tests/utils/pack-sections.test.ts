import { describe, expect, it } from 'vitest';
import {
  packSections,
  placementStyle,
  sheetTemplateRows,
  type CardFootprint,
} from '@/utils/pack-sections';

const fp = (cols: number, rows: number): CardFootprint => ({ cols, rows });

describe('packSections', () => {
  it('flows single-column cards left to right, top to bottom', () => {
    const { placements, pages } = packSections([fp(1, 1), fp(1, 1), fp(1, 1), fp(1, 1)], 3, 4);
    expect(placements).toEqual([
      { col: 0, row: 0, cols: 1, rows: 1 },
      { col: 1, row: 0, cols: 1, rows: 1 },
      { col: 2, row: 0, cols: 1, rows: 1 },
      { col: 0, row: 1, cols: 1, rows: 1 },
    ]);
    expect(pages).toBe(1);
  });

  it('fills the cells beside a tall card (no dead space)', () => {
    // Skills (1×3) beside Saves (2×1); Senses (1×1) should land under Saves.
    const { placements } = packSections([fp(1, 3), fp(2, 1), fp(1, 1)], 3, 6);
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 3 }); // skills
    expect(placements[1]).toEqual({ col: 1, row: 0, cols: 2, rows: 1 }); // saves
    // Senses tucks into the cell below Saves, beside the tall Skills card.
    expect(placements[2]).toEqual({ col: 1, row: 1, cols: 1, rows: 1 }); // senses
  });

  it('wraps a wide card that will not fit in the remaining columns', () => {
    // [1×1 @ (0,0)], then a 3-wide card can't fit beside it → wraps to row 1.
    const { placements } = packSections([fp(1, 1), fp(3, 1)], 3, 6);
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(placements[1]).toEqual({ col: 0, row: 1, cols: 3, rows: 1 });
  });

  it('bumps a card that would straddle a page break to the next page', () => {
    // Page holds 2 rows; two 3×2 cards each fill a whole page.
    const { placements, pages } = packSections([fp(3, 2), fp(3, 2)], 3, 2);
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 3, rows: 2 });
    expect(placements[1]).toEqual({ col: 0, row: 2, cols: 3, rows: 2 });
    expect(pages).toBe(2);
  });

  it('leaves the tail of a page empty when the next card is bumped', () => {
    // A 3×1 fills row 0; a 3×2 can't fit in the 1 remaining row → page 2.
    const { placements, pages } = packSections([fp(3, 1), fp(3, 2)], 3, 2);
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 3, rows: 1 });
    expect(placements[1]).toEqual({ col: 0, row: 2, cols: 3, rows: 2 });
    expect(pages).toBe(2);
  });

  it('caps a card taller than a page to a single page', () => {
    const { placements, pages } = packSections([fp(3, 9)], 3, 4);
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 3, rows: 4 });
    expect(pages).toBe(1);
  });

  it('clamps an over-wide card to the column count', () => {
    const { placements } = packSections([fp(5, 1)], 3, 4);
    expect(placements[0].cols).toBe(3);
  });
});

describe('sheetTemplateRows', () => {
  it('interleaves row-units with in-page gaps on a single page', () => {
    expect(sheetTemplateRows(1, 2)).toBe('var(--row-unit) var(--grid-gap) var(--row-unit)');
  });

  it('separates pages with the inter-page gutter track', () => {
    expect(sheetTemplateRows(2, 2)).toBe(
      'var(--row-unit) var(--grid-gap) var(--row-unit) var(--page-inter-gap) ' +
        'var(--row-unit) var(--grid-gap) var(--row-unit)',
    );
  });
});

describe('placementStyle', () => {
  it('maps a top-left full-width card to the first tracks', () => {
    expect(placementStyle({ col: 0, row: 0, cols: 3, rows: 1 }, 4)).toEqual({
      gridColumn: '1 / span 3',
      gridRow: '1 / span 1',
    });
  });

  it('spans a card across its row-units and inner gap tracks', () => {
    expect(placementStyle({ col: 1, row: 0, cols: 1, rows: 2 }, 4)).toEqual({
      gridColumn: '2 / span 1',
      gridRow: '1 / span 3',
    });
  });

  it('offsets a card on a later page past the gutter track', () => {
    // Page 1 (rowsPerPage 4), row-in-page 1 → line 1*8 + 2 + 1 = 11.
    expect(placementStyle({ col: 2, row: 5, cols: 1, rows: 2 }, 4)).toEqual({
      gridColumn: '3 / span 1',
      gridRow: '11 / span 3',
    });
  });
});
