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
  /** A continuation (“… (cont.)”) card: seated by the follow pass immediately
   * after the card it continues, so its own `home`/`priority` are ignored. */
  continuation?: boolean;
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
 * Collapse any page left ENTIRELY empty: pages with no card are dropped and every
 * card after them shifts up a whole page. Each card keeps its row WITHIN its page,
 * so intentional in-page gaps survive — only a fully blank page disappears. This
 * is what stops a drag (or a layout change) from ever stranding a blank page
 * between — or before — the content. Returns the compacted page count.
 */
function compactBlankPages(placements: CardPlacement[], perPage: number): number {
  const usedPages = new Set<number>();
  for (const placement of placements) usedPages.add(Math.floor(placement.row / perPage));

  const ordered = [...usedPages].sort((a, b) => a - b);
  const newIndexOfPage = new Map(ordered.map((page, index) => [page, index] as const));

  for (const placement of placements) {
    const page = Math.floor(placement.row / perPage);
    placement.row -= (page - newIndexOfPage.get(page)!) * perPage;
  }

  return Math.max(1, ordered.length);
}

/**
 * On-screen size of one grid cell (its column and row pitch, gap included). It
 * lets the packer weigh how FAR a bumped card would travel each way, so it can
 * flow the shorter direction instead of always forward. Defaults to unit squares
 * (used by tests), which reduces the choice to plain grid distance.
 */
export interface CellSize {
  width: number;
  height: number;
}

/**
 * The nearest free `w`×`h` cell FORWARD of (`homeCol`,`homeRow`) in reading order
 * WITHOUT leaving the home page — or `null` when the page has no room ahead (the
 * caller then decides whether to overflow to the next page).
 */
function freeCellForwardOnPage(
  grid: ReturnType<typeof createOccupancy>,
  homeCol: number,
  homeRow: number,
  w: number,
  h: number,
  perPage: number,
): { col: number; row: number } | null {
  const pageEnd = Math.floor(homeRow / perPage) * perPage + perPage;
  let col = homeCol;
  let row = homeRow;
  for (;;) {
    if (col + w > grid.cols) {
      row += 1;
      col = 0;
      continue;
    }
    if (row + h > pageEnd) return null;
    if (grid.isFree(row, col, w, h)) return { col, row };
    col += 1;
  }
}

/**
 * The nearest free `w`×`h` cell BACKWARD of (`homeCol`,`homeRow`) in reading
 * order on the same page — or `null` when there is none.
 */
function freeCellBackwardOnPage(
  grid: ReturnType<typeof createOccupancy>,
  homeCol: number,
  homeRow: number,
  w: number,
  h: number,
  perPage: number,
): { col: number; row: number } | null {
  const pageStart = Math.floor(homeRow / perPage) * perPage;
  const pageEnd = pageStart + perPage;
  const maxCol = grid.cols - w;
  let row = homeRow;
  let col = Math.min(homeCol, maxCol) - 1;
  for (;;) {
    if (col < 0) {
      row -= 1;
      col = maxCol;
      if (row < pageStart) return null;
      continue;
    }
    if (row + h <= pageEnd && grid.isFree(row, col, w, h)) return { col, row };
    col -= 1;
  }
}

/** Squared on-screen distance from a home cell to a candidate, scaled by the
 * real cell size so a column move and a row move compare fairly. */
function cellDistanceSq(
  homeCol: number,
  homeRow: number,
  target: { col: number; row: number },
  cell: CellSize,
): number {
  const dx = (target.col - homeCol) * cell.width;
  const dy = (target.row - homeRow) * cell.height;
  return dx * dx + dy * dy;
}

/**
 * Seat one card: at its `home` if free, otherwise flowed OUT OF THE WAY to the
 * nearest free slot — forward or backward in reading order on the same page,
 * whichever is the shorter on-screen move (an exact tie keeps the forward slot).
 * Only when the whole page is full does it overflow forward to the next page.
 */
function flowToNearestCell(
  grid: ReturnType<typeof createOccupancy>,
  homeCol: number,
  homeRow: number,
  w: number,
  h: number,
  perPage: number,
  cell: CellSize,
): { col: number; row: number } {
  if (grid.isFree(homeRow, homeCol, w, h)) return { col: homeCol, row: homeRow };

  const forward = freeCellForwardOnPage(grid, homeCol, homeRow, w, h, perPage);
  const backward = freeCellBackwardOnPage(grid, homeCol, homeRow, w, h, perPage);
  if (forward && backward) {
    const forwardDist = cellDistanceSq(homeCol, homeRow, forward, cell);
    const backwardDist = cellDistanceSq(homeCol, homeRow, backward, cell);
    return backwardDist < forwardDist ? backward : forward;
  }
  if (forward) return forward;
  if (backward) return backward;

  // The home page is full — a plain forward scan bumps the card onto the next
  // page (normal overflow, not a "get out of the way" move).
  return firstFreeCell(grid, homeCol, homeRow, w, h, perPage);
}

/**
 * Place every card at its own `home` cell (fully positional — no separate flow,
 * and no pinned/regular split): cards are seated in `priority` order (highest =
 * most recently moved first). Placement is TWO-PHASE: first every card claims
 * its home cell if free (a contested home goes to the higher-priority card),
 * then each displaced card flows out of the way to the nearest free slot —
 * forward OR backward in reading order on the same page — whichever is the
 * shorter on-screen move (so a card bumped next to a gap slides into it rather
 * than always wrapping forward). `cell` supplies the real cell size for that
 * distance; it defaults to unit squares. Settling homes before any card flows
 * keeps a drop LOCAL: a displaced card only ever lands in a genuine gap, never
 * on another card's home, so unrelated cards don't cascade. Free placement and intentional blanks fall out
 * naturally — a home that skips earlier cells leaves them empty. A card taller
 * than a page is capped; one that would cross a page break starts on the next
 * page. Finally, any fully-empty page is collapsed ({@link compactBlankPages})
 * so moving a card or changing a layout can never leave a blank page.
 */
export function packPositioned(
  cards: PositionedFootprint[],
  columns: number,
  rowsPerPage: number,
  cell: CellSize = { width: 1, height: 1 },
): PackedLayout {
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const grid = createOccupancy(columns);
  const placements: CardPlacement[] = new Array(cards.length);

  // Most recent (highest priority) first so a freshly-moved card wins its cell;
  // ties fall back to reading order. Continuation (“… (cont.)”) cards are held
  // back from this pass — they are seated in a final follow pass right after their
  // base so a base and its continuations always stay together in reading order.
  const order = cards
    .map((_, index) => index)
    .filter((index) => !cards[index].continuation)
    .sort((a, b) => cards[b].priority - cards[a].priority || a - b);

  // A base carries its continuation run into the cells right AFTER it, reserved at
  // the moment the base is placed so nothing else can slot between them. Scanning
  // forward from the previous card in the run keeps the whole run contiguous.
  const placeContinuations = (baseIndex: number) => {
    let after = placements[baseIndex];
    for (let j = baseIndex + 1; j < cards.length && cards[j].continuation; j += 1) {
      const w = Math.min(Math.max(1, Math.floor(cards[j].cols)), grid.cols);
      const h = Math.min(Math.max(1, Math.floor(cards[j].rows)), perPage);
      const spot = firstFreeCell(grid, after.col, after.row, w, h, perPage);
      grid.occupy(spot.row, spot.col, w, h);
      placements[j] = { col: spot.col, row: spot.row, cols: w, rows: h };
      after = placements[j];
    }
  };

  // Phase 1 — every base claims its home cell if it is free, then carries its
  // continuations into the cells after it. Priority order means a contested home
  // goes to the higher-priority (more recently moved) card; the loser is deferred.
  // Settling all uncontested homes FIRST is what keeps a drop local — a displaced
  // card can then only land in a genuine gap, never on top of another card's home.
  const deferred: { index: number; col: number; row: number; w: number; h: number }[] = [];
  for (const index of order) {
    const card = cards[index];
    const w = Math.min(Math.max(1, Math.floor(card.cols)), grid.cols);
    const h = Math.min(Math.max(1, Math.floor(card.rows)), perPage);
    const col = Math.min(Math.max(0, Math.floor(card.home.col)), grid.cols - w);
    const row = Math.max(0, Math.floor(card.home.row));
    if (grid.isFree(row, col, w, h)) {
      grid.occupy(row, col, w, h);
      placements[index] = { col, row, cols: w, rows: h };
      placeContinuations(index);
    } else {
      deferred.push({ index, col, row, w, h });
    }
  }

  // Phase 2 — each displaced base flows out of the way to the nearest free slot,
  // forward or backward, whichever is the shorter on-screen move, then carries its
  // continuations with it.
  for (const { index, col: homeCol, row: homeRow, w, h } of deferred) {
    const { col, row } = flowToNearestCell(grid, homeCol, homeRow, w, h, perPage, cell);
    grid.occupy(row, col, w, h);
    placements[index] = { col, row, cols: w, rows: h };
    placeContinuations(index);
  }

  // Pull cards up over any fully-empty page so a move or layout change never
  // strands a blank page (in-page gaps are kept).
  const pages = compactBlankPages(placements, perPage);
  return { placements, pages };
}

/**
 * Re-pack cards densely to use the fewest pages — the "Compact" action. Cards
 * are visited in their current visual reading order (top-left → bottom-right)
 * and each is seated in the TOPMOST-leftmost free cell that fits — a BACK-FILLING
 * first-fit that rescans from (0,0) every time, NOT a forward-only cursor. So a
 * card floats UP past earlier ones into a gap a taller neighbour left whenever
 * that yields a denser layout, closing gaps a plain forward flow can't reach.
 * Returns new placements in the SAME index order as the input.
 */
export function compactPlacements(
  placements: CardPlacement[],
  columns: number,
  rowsPerPage: number,
): CardPlacement[] {
  const perPage = Math.max(1, Math.floor(rowsPerPage));
  const grid = createOccupancy(columns);
  // Visit the cards in the order they currently read on the page…
  const order = placements
    .map((_, index) => index)
    .sort(
      (a, b) => placements[a].row - placements[b].row || placements[a].col - placements[b].col,
    );
  // …then seat each in the topmost free cell it fits. Rescanning from (0,0) every
  // time lets a later card back-fill a gap ABOVE an already-placed one — that is
  // what pulls cards up past others into the densest greedy pack.
  const result: CardPlacement[] = new Array(placements.length);
  for (const index of order) {
    const w = Math.min(Math.max(1, Math.floor(placements[index].cols)), grid.cols);
    const h = Math.min(Math.max(1, Math.floor(placements[index].rows)), perPage);
    const { col, row } = firstFreeCell(grid, 0, 0, w, h, perPage);
    grid.occupy(row, col, w, h);
    result[index] = { col, row, cols: w, rows: h };
  }
  return result;
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
