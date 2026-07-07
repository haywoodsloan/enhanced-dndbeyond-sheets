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
/**
 * Content-heavy sections grow taller with the number of entries they hold. Each
 * config says roughly how many entries fill one row-unit of height (`perRow`)
 * and caps the growth (`maxRows`); the floor is the section's base rows above.
 */
const DYNAMIC_ROWS: Partial<Record<SectionKey, { perRow: number; maxRows: number }>> = {
  actions: { perRow: 16, maxRows: 5 },
  spells: { perRow: 12, maxRows: 6 },
  inventory: { perRow: 10, maxRows: 6 },
  features: { perRow: 13, maxRows: 6 },
};

/**
 * The card footprint for a section. For content-heavy sections (actions,
 * spells, inventory, features) `rows` grows with `count` — the number of
 * entries in the section — clamped between the section's base rows and its
 * `maxRows`. All other sections ignore `count` and keep their fixed footprint.
 */
export function sectionSpan(key: SectionKey, count = 0): SectionSpan {
  const base = SECTION_SPAN[key];
  const dynamic = DYNAMIC_ROWS[key];
  if (!dynamic) return base;
  const rows = Math.min(
    dynamic.maxRows,
    Math.max(base.rows, Math.ceil(count / dynamic.perRow)),
  );
  return { cols: base.cols, rows };
}

/**
 * How many row-units fit on one page so the rows:columns ratio best matches the
 * print area's height:width, clamped to a sensible single digit.
 */
export function gridRowsPerPage(printWidth: number, printHeight: number): number {
  const rows = Math.round((GRID_COLUMNS * printHeight) / printWidth);
  return Math.min(9, Math.max(1, rows));
}
