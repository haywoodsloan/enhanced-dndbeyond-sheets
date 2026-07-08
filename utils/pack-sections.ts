/**
 * Page-aware packing for the section-card grid. Cards are placed on a fixed
 * column grid with real multi-row tracks, so a tall card's shorter neighbours
 * flow into the space beside it (no unfillable dead space) and any leftover
 * cells become genuine, droppable gaps. Placement is deterministic and
 * page-aware: a card that would straddle a page break is bumped to the top of
 * the next page, which replaces the old margin-push paginator.
 *
 * The result is pure geometry (no DOM), so it drives both rendering and — via
 * the drag hit-testing that reads the rendered rects — the drop targeting.
 */

/** A card's grid footprint: how many columns and row-units it spans. */
export interface CardFootprint {
  cols: number;
  rows: number;
}

/** Where a card sits on the grid. `row` is an absolute content-row index that
 * counts continuously across pages (page = floor(row / rowsPerPage)). */
export interface CardPlacement {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface PackedLayout {
  placements: CardPlacement[];
  pages: number;
}

/**
 * Place `footprints` (in order) on a `columns`-wide grid whose pages are
 * `rowsPerPage` row-units tall. Uses sparse first-fit (a forward-only cursor,
 * matching CSS `grid-auto-flow: row`) so the visual order tracks the list order
 * for hit-testing, while still filling the cells beside a tall card. A card
 * taller than a page is capped to a page; one that would cross a page break
 * starts fresh on the next page.
 */
export function packSections(
  footprints: CardFootprint[],
  columns: number,
  rowsPerPage: number,
): PackedLayout {
  const cols = Math.max(1, Math.floor(columns));
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const occupied: boolean[][] = [];

  const ensureRow = (row: number) => {
    while (occupied.length <= row) occupied.push(new Array<boolean>(cols).fill(false));
  };
  const isFree = (row: number, col: number, w: number, h: number): boolean => {
    for (let r = row; r < row + h; r += 1) {
      ensureRow(r);
      for (let c = col; c < col + w; c += 1) {
        if (occupied[r][c]) return false;
      }
    }
    return true;
  };
  const occupy = (row: number, col: number, w: number, h: number) => {
    for (let r = row; r < row + h; r += 1) {
      ensureRow(r);
      for (let c = col; c < col + w; c += 1) occupied[r][c] = true;
    }
  };

  const placements: CardPlacement[] = [];
  let cursorRow = 0;
  let cursorCol = 0;

  for (const footprint of footprints) {
    const w = Math.min(Math.max(1, Math.floor(footprint.cols)), cols);
    const h = Math.min(Math.max(1, Math.floor(footprint.rows)), perPage);

    let row = cursorRow;
    let col = cursorCol;
    for (;;) {
      if (col + w > cols) {
        row += 1;
        col = 0;
        continue;
      }
      // Keep the card on a single page; jump past a boundary it would cross.
      const pageStart = Math.floor(row / perPage) * perPage;
      if (row + h > pageStart + perPage) {
        row = pageStart + perPage;
        col = 0;
        continue;
      }
      if (isFree(row, col, w, h)) break;
      col += 1;
    }

    occupy(row, col, w, h);
    placements.push({ col, row, cols: w, rows: h });

    // Advance the cursor just past this card (forward-only — no back-filling).
    cursorRow = row;
    cursorCol = col + w;
    if (cursorCol >= cols) {
      cursorRow = row + 1;
      cursorCol = 0;
    }
  }

  const pages = Math.max(1, Math.ceil(occupied.length / perPage));
  return { placements, pages };
}

/**
 * The `grid-template-rows` value for a sheet of `pages` pages, each `rowsPerPage`
 * row-units tall. Row-gap is 0 and every gap is an explicit track, so the gutter
 * between pages (`--page-inter-gap`) can differ from the in-page gap
 * (`--grid-gap`) while cards still align to the painted page rectangles.
 */
export function sheetTemplateRows(pages: number, rowsPerPage: number): string {
  const pageCount = Math.max(1, Math.floor(pages));
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const tracks: string[] = [];
  for (let p = 0; p < pageCount; p += 1) {
    for (let r = 0; r < perPage; r += 1) {
      tracks.push('var(--row-unit)');
      if (r < perPage - 1) tracks.push('var(--grid-gap)');
    }
    if (p < pageCount - 1) tracks.push('var(--page-inter-gap)');
  }
  return tracks.join(' ');
}

/**
 * The `grid-column` / `grid-row` for a placement, translated onto the explicit
 * track list built by {@link sheetTemplateRows}. Each page contributes
 * `2 * rowsPerPage` tracks (row-units interleaved with gap tracks, plus the
 * inter-page gutter track), and a card spanning `rows` row-units covers
 * `2 * rows - 1` tracks (its inner gap tracks included).
 */
export function placementStyle(
  placement: CardPlacement,
  rowsPerPage: number,
): { gridColumn: string; gridRow: string } {
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const page = Math.floor(placement.row / perPage);
  const rowInPage = placement.row % perPage;
  const startLine = page * 2 * perPage + 2 * rowInPage + 1;
  const rowSpan = 2 * placement.rows - 1;
  return {
    gridColumn: `${placement.col + 1} / span ${placement.cols}`,
    gridRow: `${startLine} / span ${rowSpan}`,
  };
}
