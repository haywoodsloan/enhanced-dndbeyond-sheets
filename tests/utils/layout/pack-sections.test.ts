import { describe, expect, it } from 'vitest';
import {
  cellAtPoint,
  compactPlacements,
  packPositioned,
  packSections,
  placementPage,
  placementStyle,
  type CardFootprint,
} from '@/utils/layout/pack-sections';

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

describe('placementPage', () => {
  it('maps a row to its 0-based page by rowsPerPage', () => {
    expect(placementPage({ col: 0, row: 0, cols: 1, rows: 1 }, 4)).toBe(0);
    expect(placementPage({ col: 0, row: 3, cols: 1, rows: 1 }, 4)).toBe(0);
    expect(placementPage({ col: 0, row: 4, cols: 1, rows: 1 }, 4)).toBe(1);
    expect(placementPage({ col: 0, row: 9, cols: 1, rows: 1 }, 4)).toBe(2);
  });
});

describe('placementStyle', () => {
  it('maps a top-left full-width card to the first tracks', () => {
    expect(placementStyle({ col: 0, row: 0, cols: 3, rows: 1 }, 4)).toEqual({
      gridColumn: '1 / span 3',
      gridRow: '1 / span 1',
    });
  });

  it('spans a card across its row-unit tracks', () => {
    expect(placementStyle({ col: 1, row: 0, cols: 1, rows: 2 }, 4)).toEqual({
      gridColumn: '2 / span 1',
      gridRow: '1 / span 2',
    });
  });

  it('places a later-page card at its row WITHIN the page', () => {
    // Row 5 with rowsPerPage 4 → page 1, row-in-page 1 → grid row 2.
    expect(placementStyle({ col: 2, row: 5, cols: 1, rows: 2 }, 4)).toEqual({
      gridColumn: '3 / span 1',
      gridRow: '2 / span 2',
    });
  });
});

describe('cellAtPoint', () => {
  const geometry = {
    left: 0,
    top: 0,
    width: 300,
    columns: 3,
    rowsPerPage: 6,
    rowUnit: 100,
    gap: 0,
    interGap: 0,
  };

  it('maps a pointer to its column and absolute row', () => {
    expect(cellAtPoint({ x: 150, y: 250 }, geometry)).toEqual({ col: 1, row: 2 });
    expect(cellAtPoint({ x: 250, y: 50 }, geometry)).toEqual({ col: 2, row: 0 });
  });

  it('maps rows on a later page to their absolute row', () => {
    expect(cellAtPoint({ x: 50, y: 650 }, geometry)).toEqual({ col: 0, row: 6 });
  });

  it('clamps a pointer past the edges back into the grid', () => {
    expect(cellAtPoint({ x: 999, y: -10 }, geometry)).toEqual({ col: 2, row: 0 });
  });
});

describe('packPositioned', () => {
  const home = (col: number, row: number) => ({ col, row });

  it('places each card at its home when they do not collide', () => {
    const { placements } = packPositioned(
      [
        { cols: 1, rows: 1, home: home(0, 0), priority: 0 },
        { cols: 1, rows: 1, home: home(2, 0), priority: 0 },
      ],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(placements[1]).toEqual({ col: 2, row: 0, cols: 1, rows: 1 });
  });

  it('leaves earlier cells empty when a home skips them', () => {
    const { placements } = packPositioned(
      [{ cols: 1, rows: 1, home: home(2, 1), priority: 0 }],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 2, row: 1, cols: 1, rows: 1 });
  });

  it('gives a contested cell to the most recently moved card; the other flows', () => {
    // Both want (1,1); card 1 has the higher priority (moved more recently), so it
    // keeps the cell and card 0 flows forward to the next free cell.
    const { placements } = packPositioned(
      [
        { cols: 1, rows: 1, home: home(1, 1), priority: 2 },
        { cols: 1, rows: 1, home: home(1, 1), priority: 5 },
      ],
      3,
      4,
    );
    expect(placements[1]).toEqual({ col: 1, row: 1, cols: 1, rows: 1 });
    expect(placements[0]).toEqual({ col: 2, row: 1, cols: 1, rows: 1 });
  });

  it('falls back to reading order for equal-priority cards', () => {
    const { placements } = packPositioned(
      [
        { cols: 1, rows: 1, home: home(0, 0), priority: 0 },
        { cols: 1, rows: 1, home: home(0, 0), priority: 0 },
        { cols: 1, rows: 1, home: home(0, 0), priority: 0 },
      ],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(placements[1]).toEqual({ col: 1, row: 0, cols: 1, rows: 1 });
    expect(placements[2]).toEqual({ col: 2, row: 0, cols: 1, rows: 1 });
  });

  it('pulls a lone card on a later page back onto the first page', () => {
    // Home is page 2 (row 8, rowsPerPage 4) with nothing before it → the two
    // empty pages collapse and the card lands on page 0.
    const { placements, pages } = packPositioned(
      [{ cols: 1, rows: 1, home: home(0, 8), priority: 0 }],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(pages).toBe(1);
  });

  it('collapses a fully-blank page between two occupied pages', () => {
    // Card 0 fills page 0; card 1 is anchored to page 2 (row 8), so page 1 is
    // blank → it is removed and card 1 moves up to page 1 (row 4).
    const { placements, pages } = packPositioned(
      [
        { cols: 3, rows: 1, home: home(0, 0), priority: 0 },
        { cols: 3, rows: 1, home: home(0, 8), priority: 0 },
      ],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 3, rows: 1 });
    expect(placements[1]).toEqual({ col: 0, row: 4, cols: 3, rows: 1 });
    expect(pages).toBe(2);
  });

  it('keeps a card at its row WITHIN the page when collapsing blanks', () => {
    // Card 1's home is page 2, row-in-page 2 (row 10); after the blank page 1 is
    // removed it sits on page 1 at the same row-in-page (row 6).
    const { placements, pages } = packPositioned(
      [
        { cols: 3, rows: 1, home: home(0, 0), priority: 0 },
        { cols: 1, rows: 1, home: home(1, 10), priority: 0 },
      ],
      3,
      4,
    );
    expect(placements[1]).toEqual({ col: 1, row: 6, cols: 1, rows: 1 });
    expect(pages).toBe(2);
  });

  it('flows a bumped card backward into a near gap instead of wrapping forward', () => {
    // W1/W2 hold the ends of row 0, leaving (1,0) free; X wants (2,0) but W2 has
    // it. The gap at (1,0) is one column back; the next forward slot is (0,1), a
    // whole row down — so X flows BACKWARD to the nearer gap.
    const { placements } = packPositioned(
      [
        { cols: 1, rows: 1, home: home(0, 0), priority: 20 },
        { cols: 1, rows: 1, home: home(2, 0), priority: 10 },
        { cols: 1, rows: 1, home: home(2, 0), priority: 0 },
      ],
      3,
      4,
      { width: 100, height: 100 },
    );
    expect(placements[2]).toEqual({ col: 1, row: 0, cols: 1, rows: 1 });
  });

  it('uses the real cell size to pick the shorter move — short rows flow up', () => {
    // X is bumped from (1,1); its options are (2,1) one column right and (1,0)
    // one row up. With rows shorter than columns, the upward move is shorter.
    const cards = [
      { cols: 1, rows: 1, home: home(1, 1), priority: 30 },
      { cols: 1, rows: 1, home: home(0, 1), priority: 20 },
      { cols: 1, rows: 1, home: home(2, 0), priority: 10 },
      { cols: 1, rows: 1, home: home(1, 1), priority: 0 },
    ];
    const { placements } = packPositioned(cards, 3, 4, { width: 100, height: 50 });
    expect(placements[3]).toEqual({ col: 1, row: 0, cols: 1, rows: 1 });
  });

  it('uses the real cell size to pick the shorter move — narrow columns flow right', () => {
    // Same setup; now columns are narrower than rows are tall, so the sideways
    // move to (2,1) is the shorter one.
    const cards = [
      { cols: 1, rows: 1, home: home(1, 1), priority: 30 },
      { cols: 1, rows: 1, home: home(0, 1), priority: 20 },
      { cols: 1, rows: 1, home: home(2, 0), priority: 10 },
      { cols: 1, rows: 1, home: home(1, 1), priority: 0 },
    ];
    const { placements } = packPositioned(cards, 3, 4, { width: 50, height: 100 });
    expect(placements[3]).toEqual({ col: 2, row: 1, cols: 1, rows: 1 });
  });

  it('flows to a same-page slot rather than jumping to the next page', () => {
    // Row 0 is full and (2,1) is taken; X wants (2,1). There is no room ahead on
    // page 0 (next free cell would be page 1), but (1,1) is free behind it — so X
    // stays on page 0 instead of overflowing.
    const { placements, pages } = packPositioned(
      [
        { cols: 3, rows: 1, home: home(0, 0), priority: 30 },
        { cols: 1, rows: 1, home: home(2, 1), priority: 20 },
        { cols: 1, rows: 1, home: home(2, 1), priority: 0 },
      ],
      3,
      2,
      { width: 100, height: 100 },
    );
    expect(placements[2]).toEqual({ col: 1, row: 1, cols: 1, rows: 1 });
    expect(pages).toBe(1);
  });

  it('overflows to the next page only when the home page is full', () => {
    // Both rows of page 0 are full; X wants (0,0) but it is taken and there is no
    // free slot anywhere on the page, so it overflows to page 1.
    const { placements, pages } = packPositioned(
      [
        { cols: 3, rows: 1, home: home(0, 0), priority: 30 },
        { cols: 3, rows: 1, home: home(0, 1), priority: 20 },
        { cols: 1, rows: 1, home: home(0, 0), priority: 0 },
      ],
      3,
      2,
      { width: 100, height: 100 },
    );
    expect(placements[2]).toEqual({ col: 0, row: 2, cols: 1, rows: 1 });
    expect(pages).toBe(2);
  });
});

describe('compactPlacements', () => {
  it('slides scattered cards up and left to close gaps and drop pages', () => {
    // Three 1x1 cards with gaps between them; the last sits on page 1 (row 5).
    const compacted = compactPlacements(
      [
        { col: 2, row: 0, cols: 1, rows: 1 },
        { col: 0, row: 2, cols: 1, rows: 1 },
        { col: 1, row: 5, cols: 1, rows: 1 },
      ],
      3,
      4,
    );
    // They collapse onto row 0 of page 0, in reading order — zero gaps, one page.
    expect(compacted).toEqual([
      { col: 0, row: 0, cols: 1, rows: 1 },
      { col: 1, row: 0, cols: 1, rows: 1 },
      { col: 2, row: 0, cols: 1, rows: 1 },
    ]);
  });

  it('keeps the current reading order while compacting', () => {
    // index 0 currently reads LAST (row 6); index 1 reads FIRST (row 0).
    const compacted = compactPlacements(
      [
        { col: 0, row: 6, cols: 1, rows: 1 },
        { col: 0, row: 0, cols: 1, rows: 1 },
      ],
      3,
      4,
    );
    // The visually-first card takes (0,0); the visually-last takes (1,0).
    expect(compacted[1]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(compacted[0]).toEqual({ col: 1, row: 0, cols: 1, rows: 1 });
  });

  it('preserves each card footprint and returns input index order', () => {
    // A wide 2x1 card that currently trails a 1x1 card.
    const compacted = compactPlacements(
      [
        { col: 1, row: 3, cols: 2, rows: 1 },
        { col: 0, row: 0, cols: 1, rows: 1 },
      ],
      3,
      4,
    );
    // Footprints stay intact; result stays aligned to the input indices.
    expect(compacted[0]).toMatchObject({ cols: 2, rows: 1 });
    expect(compacted[1]).toMatchObject({ cols: 1, rows: 1 });
    // The 1x1 seats first at (0,0); the 2x1 follows in the next free cell.
    expect(compacted[1]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(compacted[0]).toEqual({ col: 1, row: 0, cols: 2, rows: 1 });
  });
});
