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

/** A footprint with a target cell + placement recency, for {@link packPositioned}. */
export interface PositionedFootprint {
  cols: number;
  rows: number;
  /** Preferred cell (absolute `row`): placed here if free, else the first free
   * cell forward of it. */
  home: { col: number; row: number };
  /** Placement recency — higher is seated first, so the card most recently moved
   * onto a contested cell keeps it and the rest flow forward around it. Every
   * card has one (there is no pinned/regular split); a never-moved card just
   * carries a low baseline so a freshly-dragged card outranks it. */
  priority: number;
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

/** A mutable column-occupancy grid shared by the packers. Rows grow on demand. */
function createOccupancy(columns: number) {
  const cols = Math.max(1, Math.floor(columns));
  const occupied: boolean[][] = [];
  const ensureRow = (row: number) => {
    while (occupied.length <= row) occupied.push(new Array<boolean>(cols).fill(false));
  };
  return {
    cols,
    rowCount: () => occupied.length,
    isFree(row: number, col: number, w: number, h: number): boolean {
      for (let r = row; r < row + h; r += 1) {
        ensureRow(r);
        for (let c = col; c < col + w; c += 1) if (occupied[r][c]) return false;
      }
      return true;
    },
    occupy(row: number, col: number, w: number, h: number) {
      for (let r = row; r < row + h; r += 1) {
        ensureRow(r);
        for (let c = col; c < col + w; c += 1) occupied[r][c] = true;
      }
    },
  };
}

/**
 * Scan forward from (`startCol`, `startRow`) — across the row, wrapping to the
 * next row, and jumping to the top of the next page when a card would straddle a
 * page break — for the first free cell that fits a `w`×`h` card.
 */
function firstFreeCell(
  grid: ReturnType<typeof createOccupancy>,
  startCol: number,
  startRow: number,
  w: number,
  h: number,
  perPage: number,
): { col: number; row: number } {
  let col = startCol;
  let row = startRow;
  for (;;) {
    if (col + w > grid.cols) {
      row += 1;
      col = 0;
      continue;
    }
    const pageStart = Math.floor(row / perPage) * perPage;
    if (row + h > pageStart + perPage) {
      row = pageStart + perPage;
      col = 0;
      continue;
    }
    if (grid.isFree(row, col, w, h)) return { col, row };
    col += 1;
  }
}

/**
 * Place `footprints` (in order) on a `columns`-wide grid whose pages are
 * `rowsPerPage` row-units tall, using a forward-only first-fit cursor (matching
 * CSS `grid-auto-flow: row`): each card takes the next free cell after the
 * previous one, so their visual order tracks the list order. A card taller than
 * a page is capped; one that would cross a page break starts on the next page.
 * This is the class-aware DEFAULT layout — the home cells `packPositioned` seeds
 * from.
 */
export function packSections(
  footprints: CardFootprint[],
  columns: number,
  rowsPerPage: number,
): PackedLayout {
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const grid = createOccupancy(columns);
  const placements: CardPlacement[] = new Array(footprints.length);

  let cursorCol = 0;
  let cursorRow = 0;
  footprints.forEach((footprint, index) => {
    const w = Math.min(Math.max(1, Math.floor(footprint.cols)), grid.cols);
    const h = Math.min(Math.max(1, Math.floor(footprint.rows)), perPage);
    const { col, row } = firstFreeCell(grid, cursorCol, cursorRow, w, h, perPage);
    grid.occupy(row, col, w, h);
    placements[index] = { col, row, cols: w, rows: h };

    // Advance the cursor just past this card (forward-only — no back-filling).
    cursorRow = row;
    cursorCol = col + w;
    if (cursorCol >= grid.cols) {
      cursorRow = row + 1;
      cursorCol = 0;
    }
  });

  return { placements, pages: Math.max(1, Math.ceil(grid.rowCount() / perPage)) };
}

/**
 * Place every card at its own `home` cell (fully positional — no separate flow,
 * and no pinned/regular split): cards are seated in `priority` order (highest =
 * most recently moved first), each at its home if free, else the first free cell
 * forward of it. So the card most recently dropped onto a contested cell keeps
 * it and the others flow forward around it (a displaced card slots into the next
 * free cell). Free placement and intentional blanks fall out naturally — a home
 * that skips earlier cells leaves them empty. A card taller than a page is
 * capped; one that would cross a page break starts on the next page.
 */
export function packPositioned(
  cards: PositionedFootprint[],
  columns: number,
  rowsPerPage: number,
): PackedLayout {
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const grid = createOccupancy(columns);
  const placements: CardPlacement[] = new Array(cards.length);

  // Most recent (highest priority) first so a freshly-moved card wins its cell;
  // ties fall back to reading order. Every card carries a priority, so there is
  // no separate handling for "placed" vs "regular" cards.
  const order = cards
    .map((_, index) => index)
    .sort((a, b) => cards[b].priority - cards[a].priority || a - b);

  for (const index of order) {
    const card = cards[index];
    const w = Math.min(Math.max(1, Math.floor(card.cols)), grid.cols);
    const h = Math.min(Math.max(1, Math.floor(card.rows)), perPage);
    // Start at the home cell (clamped so the card fits), then scan forward.
    const startCol = Math.min(Math.max(0, Math.floor(card.home.col)), grid.cols - w);
    const startRow = Math.max(0, Math.floor(card.home.row));
    const { col, row } = firstFreeCell(grid, startCol, startRow, w, h, perPage);
    grid.occupy(row, col, w, h);
    placements[index] = { col, row, cols: w, rows: h };
  }

  return { placements, pages: Math.max(1, Math.ceil(grid.rowCount() / perPage)) };
}

/** Which page (0-based) a placement lands on. */
export function placementPage(placement: CardPlacement, rowsPerPage: number): number {
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  return Math.floor(placement.row / perPage);
}

/**
 * The `grid-column` / `grid-row` for a placement inside its OWN page's grid.
 * Each printed page renders as a separate container with its own
 * `rowsPerPage`-tall grid (`repeat(rowsPerPage, var(--row-unit))`), so a card
 * maps onto the row WITHIN its page (`row % rowsPerPage`); a card spanning `rows`
 * row-units covers that many tracks (the `row-gap` between them is drawn inside
 * the span). Giving each page its own grid — rather than one tall grid the print
 * engine has to fragment across pages — is what keeps the printed margins exact:
 * no page ever splits a grid, so there is no cross-page gap/track for the engine
 * to drift or drop, and every page's margin is just its container's padding.
 */
export function placementStyle(
  placement: CardPlacement,
  rowsPerPage: number,
): { gridColumn: string; gridRow: string } {
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const rowInPage = placement.row % perPage;
  return {
    gridColumn: `${placement.col + 1} / span ${placement.cols}`,
    gridRow: `${rowInPage + 1} / span ${placement.rows}`,
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

/**
 * The grid cell (absolute `row` + `col`) a pointer is over — the inverse of the
 * geometry the renderer lays cards out with. Drives manual placement: dropping a
 * card on a cell moves it there. Row/col are clamped into the grid; the caller
 * decides whether the card fits.
 */
export function cellAtPoint(pointer: Point, geometry: GridGeometry): { col: number; row: number } {
  const { left, top, width, columns, rowsPerPage, rowUnit, gap, interGap } = geometry;
  const colWidth = (width - (columns - 1) * gap) / columns;
  const relX = pointer.x - left;
  const col = Math.min(columns - 1, Math.max(0, Math.floor(relX / (colWidth + gap))));

  const printHeight = rowsPerPage * rowUnit + (rowsPerPage - 1) * gap;
  const pageStride = printHeight + interGap;
  const relY = pointer.y - top;
  const page = Math.max(0, Math.floor(relY / pageStride));
  const yInPage = relY - page * pageStride;
  const rowInPage = Math.min(rowsPerPage - 1, Math.max(0, Math.floor(yInPage / (rowUnit + gap))));
  return { col, row: page * rowsPerPage + rowInPage };
}
