import { describe, expect, it } from 'vitest';
import { adjacentCardCell } from '@/utils/layout/move-card';

const footprint = { cols: 1, rows: 1 };

describe('adjacentCardCell', () => {
  it.each([
    ['left', { col: 1, row: 1 }, { page: 0, col: 0, row: 1 }],
    ['right', { col: 1, row: 1 }, { page: 0, col: 2, row: 1 }],
    ['up', { col: 1, row: 2 }, { page: 0, col: 1, row: 1 }],
    ['down', { col: 1, row: 1 }, { page: 0, col: 1, row: 2 }],
  ] as const)('moves %s within a page', (direction, placement, expected) => {
    expect(adjacentCardCell(placement, footprint, direction, 3, 4, 2)).toEqual(expected);
  });

  it('moves up and down across page boundaries', () => {
    expect(adjacentCardCell({ col: 1, row: 4 }, { cols: 1, rows: 2 }, 'up', 3, 4, 2))
      .toEqual({ page: 0, col: 1, row: 2 });
    expect(adjacentCardCell({ col: 1, row: 2 }, { cols: 1, rows: 2 }, 'down', 3, 4, 2))
      .toEqual({ page: 1, col: 1, row: 0 });
  });

  it.each([
    ['left', { col: 0, row: 0 }],
    ['right', { col: 1, row: 0 }],
    ['up', { col: 0, row: 0 }],
    ['down', { col: 0, row: 6 }],
  ] as const)('returns null at the %s outer boundary', (direction, placement) => {
    expect(
      adjacentCardCell(placement, { cols: 2, rows: 2 }, direction, 3, 4, 2),
    ).toBeNull();
  });

  it('clamps oversized footprints to the page grid', () => {
    expect(
      adjacentCardCell({ col: 0, row: 0 }, { cols: 99, rows: 99 }, 'right', 3, 4, 1),
    ).toBeNull();
    expect(
      adjacentCardCell({ col: 0, row: 0 }, { cols: 0, rows: 0 }, 'down', 3, 4, 1),
    ).toEqual({ page: 0, col: 0, row: 1 });
  });
});