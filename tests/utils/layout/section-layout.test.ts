import { describe, expect, it } from 'vitest';
import {
  gridRowsPerPage,
  inventoryListColumns,
  sectionLayoutCount,
  sectionLayoutLabel,
  sectionSpan,
} from '@/utils/layout/section-layout';

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

  it('grows a non-default curated option by its own dynamic config', () => {
    // spells Medium (index 1): dynamic { perRow: 9, maxRows: 6 }.
    expect(sectionSpan('spells', 45, 1)).toEqual({ cols: 2, rows: 5 }); // ceil(45/9)=5
  });

  it('clamps an out-of-range layout index to the first/last option', () => {
    expect(sectionSpan('attributes', 0, -5)).toEqual(sectionSpan('attributes', 0, 0));
    expect(sectionSpan('attributes', 0, 99)).toEqual(sectionSpan('attributes', 0, 1));
  });

  it('spans a full-page option to the page height, falling back to its rows', () => {
    // notes' 4th option (index 3) is fullPage.
    expect(sectionSpan('notes', 0, 3, 8)).toEqual({ cols: 3, rows: 8 });
    expect(sectionSpan('notes', 0, 3)).toEqual({ cols: 3, rows: 4 });
  });
});

describe('section layout options', () => {
  it('reports how many curated layouts a section offers', () => {
    expect(sectionLayoutCount('inventory')).toBe(3);
    expect(sectionLayoutCount('skills')).toBe(2);
    expect(sectionLayoutCount('attributes')).toBe(2);
    expect(sectionLayoutCount('proficiencies')).toBe(2);
    expect(sectionLayoutCount('portrait')).toBe(4);
    expect(sectionLayoutCount('notes')).toBe(4);
    // Sections without curated options have a single fixed layout (no toggle).
    expect(sectionLayoutCount('basics')).toBe(1);
    expect(sectionLayoutCount('wealth')).toBe(1);
    expect(sectionLayoutCount('senses')).toBe(1);
  });

  it('labels each layout option', () => {
    expect(sectionLayoutLabel('inventory', 0)).toBe('Wide');
    expect(sectionLayoutLabel('inventory', 1)).toBe('Medium');
    expect(sectionLayoutLabel('inventory', 2)).toBe('List');
    expect(sectionLayoutLabel('portrait', 3)).toBe('Large');
    // Out-of-range clamps to the last option; no options → empty string.
    expect(sectionLayoutLabel('inventory', 9)).toBe('List');
    expect(sectionLayoutLabel('basics', 0)).toBe('');
  });

  it('sizes content cards from the chosen layout, growing narrower ones taller', () => {
    expect(sectionSpan('inventory', 4, 0)).toEqual({ cols: 3, rows: 2 });
    expect(sectionSpan('inventory', 4, 1)).toEqual({ cols: 2, rows: 2 });
    expect(sectionSpan('inventory', 4, 2)).toEqual({ cols: 1, rows: 2 });
    // The List layout (perRow 7) grows sooner than Wide (perRow 20).
    expect(sectionSpan('inventory', 21, 2).rows).toBe(3); // ceil(21/7)
    expect(sectionSpan('inventory', 21, 0).rows).toBe(2); // ceil(21/20)=2
    // Spells stay at 2 rows in the List layout until the count exceeds perRow*2.
    expect(sectionSpan('spells', 20, 2)).toEqual({ cols: 1, rows: 2 }); // ceil(20/10)=2
    expect(sectionSpan('spells', 21, 2).rows).toBe(3); // ceil(21/10)=3
    // An out-of-range index clamps to the last option.
    expect(sectionSpan('inventory', 4, 9)).toEqual({ cols: 1, rows: 2 });
  });

  it('sizes fixed-count cards per layout (skills has no dynamic growth)', () => {
    expect(sectionSpan('skills', 18, 0)).toEqual({ cols: 3, rows: 1 });
    expect(sectionSpan('skills', 18, 1)).toEqual({ cols: 1, rows: 3 });
    // Out-of-range clamps to the last option.
    expect(sectionSpan('skills', 18, 9)).toEqual({ cols: 1, rows: 3 });
    // Attributes: 2×1 / 1×2 footprints.
    expect(sectionSpan('attributes', 6, 0)).toEqual({ cols: 2, rows: 1 });
    expect(sectionSpan('attributes', 6, 1)).toEqual({ cols: 1, rows: 2 });
    // Portrait scales as a whole footprint (1×1 / 1×2 / 2×1 / 2×2).
    expect(sectionSpan('portrait', 0, 0)).toEqual({ cols: 1, rows: 1 });
    expect(sectionSpan('portrait', 0, 1)).toEqual({ cols: 1, rows: 2 });
    expect(sectionSpan('portrait', 0, 2)).toEqual({ cols: 2, rows: 1 });
    expect(sectionSpan('portrait', 0, 3)).toEqual({ cols: 2, rows: 2 });
  });

  it('spans the notes Page layout to a whole page', () => {
    expect(sectionLayoutLabel('notes', 3)).toBe('Page');
    // The full-page option takes its row count from the live page geometry.
    expect(sectionSpan('notes', 0, 3, 5)).toEqual({ cols: 3, rows: 5 });
    // Falls back to the option's own rows when the page size isn't known.
    expect(sectionSpan('notes', 0, 3)).toEqual({ cols: 3, rows: 4 });
  });
});

describe('inventoryListColumns', () => {
  it('uses two columns in the wide card when the items fit, else three', () => {
    // Wide is 3-wide; two columns hold ~2/3 of the tuned three-column capacity
    // (perRow 20), so at 2 rows the cutoff is floor(20*2*2/3) = 26 items.
    expect(inventoryListColumns(24, { cols: 3, rows: 2 })).toBe(2);
    expect(inventoryListColumns(26, { cols: 3, rows: 2 })).toBe(2);
    expect(inventoryListColumns(27, { cols: 3, rows: 2 })).toBe(3);
    expect(inventoryListColumns(40, { cols: 3, rows: 2 })).toBe(3);
    // Narrower cards keep their own column count.
    expect(inventoryListColumns(24, { cols: 2, rows: 2 })).toBe(2);
    expect(inventoryListColumns(24, { cols: 1, rows: 2 })).toBe(1);
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
