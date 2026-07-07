import type { SectionKey } from '@/services/dndbeyond/model';

/** How many grid columns and row-units a section's card spans. */
export interface SectionSpan {
  cols: number;
  rows: number;
}

/** Number of grid columns and the gap between tracks, in px. */
export const GRID_COLUMNS = 3;
export const GRID_GAP = 12;

/**
 * Default card footprint per section on the grid. Rows are quantized so cards
 * spanning the same number of rows render at the same height.
 */
const SECTION_SPAN: Record<SectionKey, SectionSpan> = {
  portrait: { cols: 1, rows: 1 },
  basics: { cols: 3, rows: 1 },
  attributes: { cols: 2, rows: 1 },
  skills: { cols: 3, rows: 1 },
  savingThrows: { cols: 2, rows: 1 },
  senses: { cols: 1, rows: 1 },
  proficiencies: { cols: 2, rows: 1 },
  actions: { cols: 3, rows: 1 },
  spells: { cols: 3, rows: 1 },
  inventory: { cols: 3, rows: 2 },
  wealth: { cols: 1, rows: 1 },
  features: { cols: 3, rows: 2 },
  notes: { cols: 3, rows: 2 },
};

/** The default footprint for a section. */
export function sectionSpan(key: SectionKey): SectionSpan {
  return SECTION_SPAN[key];
}

/**
 * How many row-units fit on one page so the rows:columns ratio best matches the
 * print area's height:width, clamped to a sensible single digit.
 */
export function gridRowsPerPage(printWidth: number, printHeight: number): number {
  const rows = Math.round((GRID_COLUMNS * printHeight) / printWidth);
  return Math.min(9, Math.max(1, rows));
}
