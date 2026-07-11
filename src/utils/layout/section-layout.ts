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
  /**
   * Fill a whole printed page (full width, one page tall). The row count comes
   * from the live page geometry passed to `sectionSpan`, falling back to `rows`
   * when it isn't known.
   */
  fullPage?: boolean;
}

/**
 * Curated layout options per section: a small, ordered set the user can toggle
 * between, each tuned to how that card presents its content. The FIRST option is
 * the default and matches SECTION_SPAN so nothing changes until the user picks
 * another. Sections without an entry keep a single fixed footprint (no toggle). All these cards reflow to the card width on their own (auto-fill
 * grids, wrapping text, or a scaling image), so only the footprint is curated
 * here — the narrower options carry more rows for the taller reflowed content.
 */
const SECTION_LAYOUTS: Partial<Record<SectionKey, LayoutOption[]>> = {
  attributes: [
    { label: 'Wide', cols: 2, rows: 1 },
    { label: 'Tall', cols: 1, rows: 2 },
  ],
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
    { label: 'List', cols: 1, rows: 2, dynamic: { perRow: 10, maxRows: 6 } },
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
    { label: 'Page', cols: 3, rows: 4, fullPage: true },
  ],
  portrait: [
    { label: 'Small', cols: 1, rows: 1 },
    { label: 'Tall', cols: 1, rows: 2 },
    { label: 'Wide', cols: 2, rows: 1 },
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
 * the chosen `layoutIndex` picks the option: its `cols` plus `rows`, where a
 * content-heavy option grows `rows` with `count` (floored at the option's `rows`,
 * capped at its `dynamic.maxRows`) and a `fullPage` option spans `rowsPerPage`
 * rows (one page tall). Sections without curated layouts keep a fixed footprint.
 */
export function sectionSpan(
  key: SectionKey,
  count = 0,
  layoutIndex = 0,
  rowsPerPage?: number,
): SectionSpan {
  const options = SECTION_LAYOUTS[key];
  if (options && options.length > 0) {
    const option = options[clampIndex(layoutIndex, options.length)];
    if (option.fullPage) {
      return { cols: option.cols, rows: rowsPerPage ?? option.rows };
    }
    const rows = option.dynamic
      ? Math.min(
          option.dynamic.maxRows,
          Math.max(option.rows, Math.ceil(count / option.dynamic.perRow)),
        )
      : option.rows;
    return { cols: option.cols, rows };
  }

  // Sections without curated layouts keep a fixed footprint.
  return SECTION_SPAN[key];
}

/**
 * The layout option index the toggle should advance to: the next option after
 * `current` (wrapping) whose card FITS the page — its height ≤ `rowsPerPage` at
 * this entry `count` — skipping any option that would overflow (be taller than a
 * page). Returns `current` when no OTHER option fits, i.e. the toggle should be
 * disabled.
 */
export function nextViableLayoutIndex(
  key: SectionKey,
  current: number,
  count: number,
  rowsPerPage: number,
): number {
  const total = sectionLayoutCount(key);
  for (let step = 1; step < total; step += 1) {
    const candidate = (current + step) % total;
    if (sectionSpan(key, count, candidate, rowsPerPage).rows <= rowsPerPage) return candidate;
  }
  return current;
}

/**
 * Whether the layout toggle can switch to another option — true only when some
 * option OTHER than `current` fits the page at this `count`. When false (every
 * other option would overflow a page), the toggle is disabled.
 */
export function canCycleLayout(
  key: SectionKey,
  current: number,
  count: number,
  rowsPerPage: number,
): boolean {
  return nextViableLayoutIndex(key, current, count, rowsPerPage) !== current;
}

/**
 * Sections whose card renders at its NATURAL content height — a list or text
 * block that doesn't stretch to fill — so its footprint may shrink to the
 * measured content instead of a count-based estimate (which can leave a tall,
 * half-empty card). The others (portrait, ability scores, skills, saves,
 * proficiencies, wealth, inventory) fill their footprint by design and keep
 * their curated height.
 */
export const CONTENT_FIT_SECTIONS: ReadonlySet<SectionKey> = new Set<SectionKey>([
  'actions',
  'spells',
  'features',
  'notes',
]);

/**
 * The fewest whole row-units that hold `height` px on a grid whose row pitch is
 * `rowUnit + gap` (a card spanning R rows is `R*rowUnit + (R-1)*gap` tall),
 * clamped to [1, `maxRows`]. Used to shrink a content-fit card's footprint to
 * its measured height without dropping below one row or above its estimate.
 */
export function rowsForHeight(
  height: number,
  rowUnit: number,
  gap: number,
  maxRows: number,
): number {
  const pitch = rowUnit + gap;
  const cap = Math.max(1, Math.floor(maxRows));
  if (pitch <= 0) return cap;
  const rows = Math.ceil((height + gap) / pitch);
  return Math.min(Math.max(1, rows), cap);
}

/**
 * How many internal columns the inventory list renders. The wide (3-col) card
 * prefers 2 wider columns for readability, dropping to 3 only when the items
 * wouldn't fit two columns at the card's height; narrower cards keep their own
 * column count. A two-column layout holds ~⅔ the items of the tuned three-column
 * one at the same height.
 */
export function inventoryListColumns(count: number, span: SectionSpan): number {
  if (span.cols < 3) return span.cols;
  const perRow = SECTION_LAYOUTS.inventory?.[0]?.dynamic?.perRow ?? 20;
  const twoColumnCapacity = Math.floor((perRow * 2 * span.rows) / 3);
  return count <= twoColumnCapacity ? 2 : 3;
}

/**
 * How many row-units fit on one page so the rows:columns ratio best matches the
 * print area's height:width, clamped to a sensible single digit.
 */
export function gridRowsPerPage(printWidth: number, printHeight: number): number {
  const rows = Math.round((GRID_COLUMNS * printHeight) / printWidth);
  return Math.min(9, Math.max(1, rows));
}
