export type CardMoveDirection = 'up' | 'down' | 'left' | 'right';

interface GridPlacement {
  col: number;
  /** Absolute row across all pages. */
  row: number;
}

interface CardFootprint {
  cols: number;
  rows: number;
}

export interface CardCell {
  page: number;
  col: number;
  row: number;
}

/**
 * Resolve the adjacent valid cell for keyboard card movement. Vertical moves
 * cross page boundaries; horizontal moves stay on the current page. Returns
 * null when the card is already against the requested outer boundary.
 */
export function adjacentCardCell(
  placement: GridPlacement,
  footprint: CardFootprint,
  direction: CardMoveDirection,
  columns: number,
  rowsPerPage: number,
  pageCount: number,
): CardCell | null {
  const width = Math.min(Math.max(1, footprint.cols), columns);
  const height = Math.min(Math.max(1, footprint.rows), rowsPerPage);
  const maximumPage = Math.max(0, pageCount - 1);
  const currentPage = Math.min(Math.floor(placement.row / rowsPerPage), maximumPage);
  const currentRow = placement.row % rowsPerPage;
  let page = currentPage;
  let col = placement.col;
  let row = currentRow;

  if (direction === 'left') col = Math.max(0, col - 1);
  if (direction === 'right') col = Math.min(columns - width, col + 1);
  if (direction === 'up') {
    if (row > 0) row -= 1;
    else if (page > 0) {
      page -= 1;
      row = rowsPerPage - height;
    }
  }
  if (direction === 'down') {
    if (row < rowsPerPage - height) row += 1;
    else if (page < maximumPage) {
      page += 1;
      row = 0;
    }
  }

  return page === currentPage && col === placement.col && row === currentRow
    ? null
    : { page, col, row };
}