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
  actions: { cols: 3, rows: 2 },
  spells: { cols: 3, rows: 2 },
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
  actions: { perRow: 12, maxRows: 5 },
  spells: { perRow: 12, maxRows: 6 },
  inventory: { perRow: 20, maxRows: 6 },
  features: { perRow: 13, maxRows: 6 },
};

/** One hand-designed footprint a card can be toggled to. */
export interface LayoutOption {
  /** Short name shown in the card's layout toggle. */
  label: string;
  /** Grid columns the card spans. */
  cols: number;
  /** Base height in row-units (the floor when it also grows with content). */
  rows: number;
  /** Grow rows with the entry count, capped at `maxRows` (like DYNAMIC_ROWS). */
  dynamic?: { perRow: number; maxRows: number };
}

/**
 * Curated layout options per section: a small, ordered set the user can toggle
 * between, each tuned to how that card presents its content. The FIRST option is
 * the default and matches SECTION_SPAN / DYNAMIC_ROWS so nothing changes until
 * the user picks another. Sections without an entry keep a single fixed footprint
 * (no toggle). All these cards reflow to the card width on their own (auto-fill
 * grids, wrapping text, or a scaling image), so only the footprint is curated
 * here — the narrower options carry more rows for the taller reflowed content.
 */
const SECTION_LAYOUTS: Partial<Record<SectionKey, LayoutOption[]>> = {
  skills: [
    { label: 'Wide', cols: 3, rows: 1 },
    { label: 'List', cols: 1, rows: 3 },
  ],
  proficiencies: [
    { label: 'Wide', cols: 2, rows: 1 },
    { label: 'List', cols: 1, rows: 1 },
  ],
  actions: [
    { label: 'Wide', cols: 3, rows: 2, dynamic: { perRow: 12, maxRows: 5 } },
    { label: 'Medium', cols: 2, rows: 2, dynamic: { perRow: 8, maxRows: 6 } },
    { label: 'List', cols: 1, rows: 2, dynamic: { perRow: 5, maxRows: 6 } },
  ],
  spells: [
    { label: 'Wide', cols: 3, rows: 2, dynamic: { perRow: 12, maxRows: 6 } },
    { label: 'Medium', cols: 2, rows: 2, dynamic: { perRow: 9, maxRows: 6 } },
    { label: 'List', cols: 1, rows: 2, dynamic: { perRow: 6, maxRows: 6 } },
  ],
  inventory: [
    { label: 'Wide', cols: 3, rows: 2, dynamic: { perRow: 20, maxRows: 6 } },
    { label: 'Medium', cols: 2, rows: 2, dynamic: { perRow: 13, maxRows: 6 } },
    { label: 'List', cols: 1, rows: 2, dynamic: { perRow: 7, maxRows: 6 } },
  ],
  features: [
    { label: 'Wide', cols: 3, rows: 2, dynamic: { perRow: 13, maxRows: 6 } },
    { label: 'Medium', cols: 2, rows: 2, dynamic: { perRow: 9, maxRows: 6 } },
    { label: 'List', cols: 1, rows: 2, dynamic: { perRow: 5, maxRows: 6 } },
  ],
  notes: [
    { label: 'Wide', cols: 3, rows: 2 },
    { label: 'Medium', cols: 2, rows: 2 },
    { label: 'List', cols: 1, rows: 3 },
  ],
  portrait: [
    { label: 'Small', cols: 1, rows: 1 },
    { label: 'Large', cols: 2, rows: 2 },
  ],
};

/** How many layout options a section offers (1 = no toggle). */
export function sectionLayoutCount(key: SectionKey): number {
  return SECTION_LAYOUTS[key]?.length ?? 1;
}

/** The label of a section's chosen layout option (empty when it has none). */
export function sectionLayoutLabel(key: SectionKey, layoutIndex = 0): string {
  const options = SECTION_LAYOUTS[key];
  if (!options || options.length === 0) return '';
  return options[clampIndex(layoutIndex, options.length)].label;
}

function clampIndex(index: number, length: number): number {
  if (index < 0) return 0;
  if (index > length - 1) return length - 1;
  return index;
}

/**
 * The card footprint for a section. When the section has curated `SECTION_LAYOUTS`
 * the chosen `layoutIndex` picks the option (its `cols` plus a floor/grown
 * `rows`); otherwise `rows` grows with `count` for content-heavy sections and all
 * others keep their fixed footprint.
 */
export function sectionSpan(key: SectionKey, count = 0, layoutIndex = 0): SectionSpan {
  const options = SECTION_LAYOUTS[key];
  if (options && options.length > 0) {
    const option = options[clampIndex(layoutIndex, options.length)];
    const rows = option.dynamic
      ? Math.min(
          option.dynamic.maxRows,
          Math.max(option.rows, Math.ceil(count / option.dynamic.perRow)),
        )
      : option.rows;
    return { cols: option.cols, rows };
  }

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
