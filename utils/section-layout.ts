import type { SectionKey } from '@/services/dndbeyond/model';

/** How many grid columns and row-units a section's card spans. */
export interface SectionSpan {
  cols: number;
  rows: number;
}

/** Height of one grid row-unit and the gap between tracks, in px. */
export const ROW_UNIT = 130;
export const GRID_GAP = 12;

/**
 * Default card footprint per section on the 3-column grid. Rows are quantized so
 * cards spanning the same number of rows render at the same height.
 */
const SECTION_SPAN: Record<SectionKey, SectionSpan> = {
  basics: { cols: 3, rows: 3 },
  attributes: { cols: 2, rows: 2 },
  skills: { cols: 3, rows: 2 },
  savingThrows: { cols: 2, rows: 2 },
  proficiencies: { cols: 2, rows: 2 },
  actions: { cols: 3, rows: 2 },
  spells: { cols: 3, rows: 2 },
  inventory: { cols: 3, rows: 2 },
  wealth: { cols: 1, rows: 1 },
  features: { cols: 3, rows: 3 },
};

/** The default footprint for a section. */
export function sectionSpan(key: SectionKey): SectionSpan {
  return SECTION_SPAN[key];
}

/** Pixel height of a card spanning `rows` row-units, including the inner gaps. */
export function cardHeight(rows: number): number {
  return rows * ROW_UNIT + (rows - 1) * GRID_GAP;
}
