import { describe, expect, it } from 'vitest';
import {
  cellAtPoint,
  packedDropIndex,
  packPositioned,
  packSections,
  placementPage,
  placementStyle,
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

describe('packedDropIndex', () => {
  // Three 100px columns (no gaps) on a tall single page, so each row is 100px.
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
  // basics(3x1), attributes(1x2), portrait(1x1), skills(1x3), saves(2x1), senses(1x1).
  // Skills is the tall column-2 card; the cell under the portrait (col 1, row 2)
  // stays empty because Saves is 2-wide and wraps past it.
  const footprints = [fp(3, 1), fp(1, 2), fp(1, 1), fp(1, 3), fp(2, 1), fp(1, 1)];

  it('drops a card into the empty cell beside a tall neighbour', () => {
    // The gap under the portrait is (col 1, row 2) → x∈[100,200], y∈[200,300].
    // Dragging Senses (index 5) there inserts it right after Skills (index 4).
    expect(packedDropIndex({ x: 150, y: 250 }, footprints, geometry, 5)).toBe(4);
  });

  it('is a no-op when the pointer maps back to the card’s own slot', () => {
    // Senses currently packs to (col 0, row 4) → x∈[0,100], y∈[400,500].
    expect(packedDropIndex({ x: 50, y: 450 }, footprints, geometry, 5)).toBe(-1);
  });

  it('is a no-op for an out-of-range source index', () => {
    expect(packedDropIndex({ x: 150, y: 250 }, footprints, geometry, 9)).toBe(-1);
  });
});

describe('packSections anchors', () => {
  it('pins an anchored card at its cell and flows the rest around it', () => {
    const { placements } = packSections(
      [fp(1, 1), { cols: 1, rows: 1, anchor: { col: 2, row: 0 } }, fp(1, 1)],
      3,
      4,
    );
    expect(placements[1]).toEqual({ col: 2, row: 0, cols: 1, rows: 1 });
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(placements[2]).toEqual({ col: 1, row: 0, cols: 1, rows: 1 });
  });

  it('leaves earlier cells empty when a card is pinned to a later cell', () => {
    const { placements } = packSections(
      [{ cols: 1, rows: 1, anchor: { col: 2, row: 1 } }],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 2, row: 1, cols: 1, rows: 1 });
  });

  it('falls back to flow when the anchor overlaps an already-placed card', () => {
    const { placements } = packSections(
      [
        { cols: 1, rows: 1, anchor: { col: 0, row: 0 } },
        { cols: 1, rows: 1, anchor: { col: 0, row: 0 } },
      ],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(placements[1]).toEqual({ col: 1, row: 0, cols: 1, rows: 1 });
  });

  it('falls back to flow when the anchor is off the grid', () => {
    const { placements } = packSections(
      [{ cols: 1, rows: 1, anchor: { col: 3, row: 0 } }],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
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
        { cols: 1, rows: 1, home: home(0, 0) },
        { cols: 1, rows: 1, home: home(2, 0) },
      ],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(placements[1]).toEqual({ col: 2, row: 0, cols: 1, rows: 1 });
  });

  it('leaves earlier cells empty when a home skips them', () => {
    const { placements } = packPositioned(
      [{ cols: 1, rows: 1, home: home(2, 1) }],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 2, row: 1, cols: 1, rows: 1 });
  });

  it('gives a contested cell to the earlier card; the later one flows forward', () => {
    const { placements } = packPositioned(
      [
        { cols: 1, rows: 1, home: home(1, 1) },
        { cols: 1, rows: 1, home: home(1, 1) },
      ],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 1, row: 1, cols: 1, rows: 1 });
    expect(placements[1]).toEqual({ col: 2, row: 1, cols: 1, rows: 1 });
  });

  it('treats every card the same — reading order settles overlaps', () => {
    const { placements } = packPositioned(
      [
        { cols: 1, rows: 1, home: home(0, 0) },
        { cols: 1, rows: 1, home: home(0, 0) },
        { cols: 1, rows: 1, home: home(0, 0) },
      ],
      3,
      4,
    );
    expect(placements[0]).toEqual({ col: 0, row: 0, cols: 1, rows: 1 });
    expect(placements[1]).toEqual({ col: 1, row: 0, cols: 1, rows: 1 });
    expect(placements[2]).toEqual({ col: 2, row: 0, cols: 1, rows: 1 });
  });
});
