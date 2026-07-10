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

/** A card's grid footprint: how many columns and row-units it spans, plus an
 * optional manual `anchor` cell it is pinned to. */
export interface CardFootprint {
  cols: number;
  rows: number;
  /** Manual placement: pin the card at this cell (absolute `row`, `col`) instead
   * of letting it flow. Ignored (the card flows) when it no longer fits there. */
  anchor?: { col: number; row: number };
}

/** A footprint with a target cell + placement priority, for {@link packPositioned}. */
export interface PositionedFootprint {
  cols: number;
  rows: number;
  /** Preferred cell (absolute `row`): placed here if free, else the first free
   * cell forward of it. */
  home: { col: number; row: number };
  /** Higher priority is placed first, so it wins a contested cell — the loser
   * flows forward from its own home (and returns to it when unblocked). */
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

/**
 * Place `footprints` (in order) on a `columns`-wide grid whose pages are
 * `rowsPerPage` row-units tall. Cards carrying an `anchor` are pinned to that
 * cell first (pass 1); the rest then flow in order with a sparse first-fit
 * forward-only cursor (matching CSS `grid-auto-flow: row`) around the pinned
 * cards (pass 2), so the flowing cards' visual order still tracks the list order
 * for hit-testing while the pinned cards sit exactly where the user dropped them
 * (earlier cells left empty). An anchor that no longer fits (off-grid, straddles
 * a page, or overlaps) is dropped and that card simply flows. A card taller than
 * a page is capped; one that would cross a page break starts on the next page.
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

  const placements: CardPlacement[] = new Array(footprints.length);
  const clampW = (footprint: CardFootprint) => Math.min(Math.max(1, Math.floor(footprint.cols)), cols);
  const clampH = (footprint: CardFootprint) => Math.min(Math.max(1, Math.floor(footprint.rows)), perPage);

  // Pass 1: pin each anchored card at its cell. An anchor that no longer fits
  // (off-grid, straddles a page, or overlaps an already-placed card) is deferred
  // to the flow, so a manual placement degrades gracefully to normal flow.
  const flow: number[] = [];
  footprints.forEach((footprint, index) => {
    const anchor = footprint.anchor;
    if (!anchor) {
      flow.push(index);
      return;
    }
    const w = clampW(footprint);
    const h = clampH(footprint);
    const col = Math.floor(anchor.col);
    const row = Math.floor(anchor.row);
    const pageStart = Math.floor(row / perPage) * perPage;
    const fits =
      col >= 0 &&
      col + w <= cols &&
      row >= 0 &&
      row + h <= pageStart + perPage &&
      isFree(row, col, w, h);
    if (fits) {
      occupy(row, col, w, h);
      placements[index] = { col, row, cols: w, rows: h };
    } else {
      flow.push(index);
    }
  });

  // Pass 2: flow the remaining cards with a forward-only first-fit cursor,
  // skipping the cells the anchored cards took.
  let cursorRow = 0;
  let cursorCol = 0;
  for (const index of flow) {
    const footprint = footprints[index];
    const w = clampW(footprint);
    const h = clampH(footprint);

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
    placements[index] = { col, row, cols: w, rows: h };

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
 * Place every card at its own `home` cell (fully positional — no separate flow):
 * cards are laid down in PRIORITY order (highest first), each at its home if
 * free, else the first free cell forward of it. So the highest-priority card
 * wins a contested cell and lower-priority cards flow forward around it (and
 * snap back to their home once it's free again). Free placement and intentional
 * blanks fall out naturally — a home that skips earlier cells leaves them empty.
 * A card taller than a page is capped; one that would cross a page break starts
 * on the next page.
 */
export function packPositioned(
  cards: PositionedFootprint[],
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

  const placements: CardPlacement[] = new Array(cards.length);
  // Highest priority first; ties keep the input (reading) order.
  const order = cards.map((_, index) => index).sort((a, b) => cards[b].priority - cards[a].priority || a - b);

  for (const index of order) {
    const card = cards[index];
    const w = Math.min(Math.max(1, Math.floor(card.cols)), cols);
    const h = Math.min(Math.max(1, Math.floor(card.rows)), perPage);

    // Start at the home cell (clamped so the card fits), then scan forward.
    let col = Math.min(Math.max(0, Math.floor(card.home.col)), cols - w);
    let row = Math.max(0, Math.floor(card.home.row));
    for (;;) {
      if (col + w > cols) {
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
      if (isFree(row, col, w, h)) break;
      col += 1;
    }

    occupy(row, col, w, h);
    placements[index] = { col, row, cols: w, rows: h };
  }

  const pages = Math.max(1, Math.ceil(occupied.length / perPage));
  return { placements, pages };
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

/**
 * The grid cell (absolute `row` + `col`) a pointer is over — the inverse of the
 * geometry `rowTop` uses. Drives manual placement: dropping a card on an empty
 * cell pins it there. Row/col are clamped into the grid; the caller decides
 * whether the cell is free and whether the card fits.
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
