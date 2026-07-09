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
 * row-units tall. The in-row gaps come from the grid's `row-gap` (a real gap,
 * which the print engine honours the same way it does `column-gap`); only the
 * taller between-pages gutter is an explicit `--page-inter-gap` track, so the
 * page separation can still differ from the in-row gap while cards align to the
 * painted page rectangles. (An earlier version used empty `--grid-gap` tracks
 * for the in-row gaps too, but Chrome drops empty gap tracks when it fragments
 * the grid across printed pages, so the rows printed with no vertical gap.)
 */
export function sheetTemplateRows(pages: number, rowsPerPage: number): string {
  const pageCount = Math.max(1, Math.floor(pages));
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const tracks: string[] = [];
  for (let p = 0; p < pageCount; p += 1) {
    for (let r = 0; r < perPage; r += 1) {
      tracks.push('var(--row-unit)');
    }
    if (p < pageCount - 1) tracks.push('var(--page-inter-gap)');
  }
  return tracks.join(' ');
}

/**
 * The `grid-column` / `grid-row` for a placement, translated onto the track list
 * built by {@link sheetTemplateRows}. Each page contributes `rowsPerPage`
 * row-unit tracks plus one inter-page gutter track, and a card spanning `rows`
 * row-units covers `rows` tracks (the `row-gap` between them is drawn inside the
 * span automatically).
 */
export function placementStyle(
  placement: CardPlacement,
  rowsPerPage: number,
): { gridColumn: string; gridRow: string } {
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const page = Math.floor(placement.row / perPage);
  const rowInPage = placement.row % perPage;
  const startLine = page * (perPage + 1) + rowInPage + 1;
  return {
    gridColumn: `${placement.col + 1} / span ${placement.cols}`,
    gridRow: `${startLine} / span ${placement.rows}`,
  };
}

/** A pointer position in viewport pixels. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Pixel geometry of the rendered sheet grid — enough to turn a packer placement
 * back into a viewport rect: the grid's top-left and content width, the column
 * count, and the row-unit / in-row gap / inter-page gap heights.
 */
export interface GridGeometry {
  left: number;
  top: number;
  width: number;
  columns: number;
  rowsPerPage: number;
  rowUnit: number;
  gap: number;
  interGap: number;
}

/** Array move: remove the item at `from` and re-insert it at `to`. */
function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Top offset (px) of content-row `row`, including the taller inter-page gap. */
function rowTop(row: number, g: GridGeometry): number {
  const page = Math.floor(row / g.rowsPerPage);
  const rowInPage = row % g.rowsPerPage;
  return row * g.rowUnit + (page * (g.rowsPerPage - 1) + rowInPage) * g.gap + page * g.interGap;
}

/**
 * The insertion index that would drop the card at `fromIndex` under `pointer`.
 * For each candidate slot it re-packs the footprints with the card moved there,
 * turns that card's resulting placement into a viewport rect, and keeps the slot
 * whose rect holds the pointer (nearest centre breaks ties). Because it drives
 * the REAL packer it lands the card in the empty cells beside a tall card that a
 * plain reading-order scan of the rendered rects can't resolve. Returns -1 when
 * the pointer maps back to the card's own slot, or to no landing slot at all.
 */
export function packedDropIndex(
  pointer: Point,
  footprints: CardFootprint[],
  geometry: GridGeometry,
  fromIndex: number,
): number {
  const count = footprints.length;
  if (fromIndex < 0 || fromIndex >= count) return -1;
  const colGap = geometry.gap;
  const colWidth = (geometry.width - (geometry.columns - 1) * colGap) / geometry.columns;

  let best = -1;
  let bestDistance = Infinity;
  for (let to = 0; to < count; to += 1) {
    const { placements } = packSections(
      moveItem(footprints, fromIndex, to),
      geometry.columns,
      geometry.rowsPerPage,
    );
    const placement = placements[to];
    const left = geometry.left + placement.col * (colWidth + colGap);
    const right = left + placement.cols * colWidth + (placement.cols - 1) * colGap;
    const top = geometry.top + rowTop(placement.row, geometry);
    const bottom = top + placement.rows * geometry.rowUnit + (placement.rows - 1) * geometry.gap;
    if (pointer.x < left || pointer.x > right || pointer.y < top || pointer.y > bottom) continue;
    const dx = pointer.x - (left + right) / 2;
    const dy = pointer.y - (top + bottom) / 2;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = to;
    }
  }
  return best === fromIndex ? -1 : best;
}
