import { describe, expect, it } from 'vitest';
import {
  gridRowsPerPage,
  sectionLayoutCount,
  sectionLayoutLabel,
  sectionSpan,
} from '@/utils/section-layout';

describe('sectionSpan', () => {
  it('gives content-heavy sections a larger footprint', () => {
    expect(sectionSpan('features')).toEqual({ cols: 3, rows: 2 });
    expect(sectionSpan('portrait')).toEqual({ cols: 1, rows: 1 });
    expect(sectionSpan('basics')).toEqual({ cols: 3, rows: 1 });
    expect(sectionSpan('attributes')).toEqual({ cols: 2, rows: 1 });
    expect(sectionSpan('savingThrows')).toEqual({ cols: 2, rows: 1 });
    expect(sectionSpan('senses')).toEqual({ cols: 1, rows: 1 });
    expect(sectionSpan('proficiencies')).toEqual({ cols: 2, rows: 1 });
    expect(sectionSpan('wealth')).toEqual({ cols: 1, rows: 1 });
    expect(sectionSpan('notes')).toEqual({ cols: 3, rows: 2 });
  });
});

describe('sectionSpan dynamic height', () => {
  it('keeps base rows for small content-heavy sections', () => {
    expect(sectionSpan('actions', 3)).toEqual({ cols: 3, rows: 2 });
    expect(sectionSpan('spells', 5)).toEqual({ cols: 3, rows: 2 });
    expect(sectionSpan('inventory', 4)).toEqual({ cols: 3, rows: 2 });
  });

  it('grows rows as entries increase', () => {
    expect(sectionSpan('actions', 40).rows).toBe(4); // ceil(40/12)
    expect(sectionSpan('spells', 40).rows).toBe(4); // ceil(40/12)
    expect(sectionSpan('inventory', 60).rows).toBe(3); // ceil(60/20)
    expect(sectionSpan('features', 39).rows).toBe(3); // ceil(39/13)
  });

  it('caps growth at each section maxRows', () => {
    expect(sectionSpan('actions', 500).rows).toBe(5);
    expect(sectionSpan('inventory', 500).rows).toBe(6);
  });

  it('ignores count for fixed sections', () => {
    expect(sectionSpan('skills', 999)).toEqual({ cols: 3, rows: 1 });
    expect(sectionSpan('basics', 999)).toEqual({ cols: 3, rows: 1 });
  });
});

describe('section layout options', () => {
  it('reports how many curated layouts a section offers', () => {
    expect(sectionLayoutCount('inventory')).toBe(3);
    // Sections without curated options have a single fixed layout (no toggle).
    expect(sectionLayoutCount('spells')).toBe(1);
    expect(sectionLayoutCount('basics')).toBe(1);
  });

  it('labels each inventory layout option', () => {
    expect(sectionLayoutLabel('inventory', 0)).toBe('Wide');
    expect(sectionLayoutLabel('inventory', 1)).toBe('Medium');
    expect(sectionLayoutLabel('inventory', 2)).toBe('List');
    // Out-of-range clamps to the last option; no options → empty string.
    expect(sectionLayoutLabel('inventory', 9)).toBe('List');
    expect(sectionLayoutLabel('spells', 0)).toBe('');
  });

  it('sizes the card from the chosen inventory layout', () => {
    expect(sectionSpan('inventory', 4, 0)).toEqual({ cols: 3, rows: 2 });
    expect(sectionSpan('inventory', 4, 1)).toEqual({ cols: 2, rows: 2 });
    expect(sectionSpan('inventory', 4, 2)).toEqual({ cols: 1, rows: 2 });
    // The List layout (perRow 7) grows sooner than Wide (perRow 20).
    expect(sectionSpan('inventory', 21, 2).rows).toBe(3); // ceil(21/7)
    expect(sectionSpan('inventory', 21, 0).rows).toBe(2); // ceil(21/20)=2
    // An out-of-range index clamps to the last option.
    expect(sectionSpan('inventory', 4, 9)).toEqual({ cols: 1, rows: 2 });
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
