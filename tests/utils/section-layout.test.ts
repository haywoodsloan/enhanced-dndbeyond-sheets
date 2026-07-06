import { describe, expect, it } from 'vitest';
import { gridRowsPerPage, sectionSpan } from '@/utils/section-layout';

describe('sectionSpan', () => {
  it('gives content-heavy sections a larger footprint', () => {
    expect(sectionSpan('features')).toEqual({ cols: 3, rows: 2 });
    expect(sectionSpan('portrait')).toEqual({ cols: 1, rows: 1 });
    expect(sectionSpan('basics')).toEqual({ cols: 3, rows: 1 });
    expect(sectionSpan('attributes')).toEqual({ cols: 2, rows: 1 });
    expect(sectionSpan('wealth')).toEqual({ cols: 1, rows: 1 });
  });
});

describe('gridRowsPerPage', () => {
  it('matches rows:cols to the print-area aspect ratio', () => {
    // Letter print area ~7.5x10in => 720x960px, 3 cols => 4 rows.
    expect(gridRowsPerPage(720, 960)).toBe(4);
    // A square area yields as many rows as columns.
    expect(gridRowsPerPage(500, 500)).toBe(3);
    // Extreme ratios are clamped to a single digit.
    expect(gridRowsPerPage(100, 1000)).toBe(9);
  });
});
