import { describe, expect, it } from 'vitest';
import {
  GRID_GAP,
  ROW_UNIT,
  cardHeight,
  sectionSpan,
} from '@/utils/section-layout';

describe('sectionSpan', () => {
  it('gives content-heavy sections a larger footprint', () => {
    expect(sectionSpan('spells')).toEqual({ cols: 3, rows: 2 });
    expect(sectionSpan('features')).toEqual({ cols: 3, rows: 3 });
    expect(sectionSpan('attributes')).toEqual({ cols: 2, rows: 2 });
    expect(sectionSpan('wealth')).toEqual({ cols: 1, rows: 1 });
  });
});

describe('cardHeight', () => {
  it('quantizes height to row units plus inner gaps', () => {
    expect(cardHeight(1)).toBe(ROW_UNIT);
    expect(cardHeight(2)).toBe(ROW_UNIT * 2 + GRID_GAP);
    expect(cardHeight(3)).toBe(ROW_UNIT * 3 + GRID_GAP * 2);
  });
});
