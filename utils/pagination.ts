/**
 * Screen-side pagination for the print preview. The sheet renders as one
 * continuous column painted (via a repeating gradient) to look like stacked
 * pages. Browsers don't reflow arbitrary flowing content into fixed pages on
 * screen, so this computes how far each card must be pushed down so that no
 * card straddles a page break — a card that can't fit in the remaining space on
 * its page moves to the top of the next page's content area.
 */

export interface LayoutBox {
  /** Distance from the paper's top edge to the box's top, in px. */
  top: number;
  /** Box height in px. */
  height: number;
}

export interface PageMetrics {
  /** White page band height in px (the physical page height). */
  band: number;
  /** Desk-colored gap between page bands in px. */
  gutter: number;
  /** Printable margin inside each page in px. */
  margin: number;
}

/**
 * Given each box's natural position (as if no pushing had happened), return the
 * extra top margin in px to apply to each box so none straddles a page break.
 * Boxes that share a top (the same visual row) are pushed together. A box taller
 * than a single page's content area is left in place, since it cannot fit
 * anywhere. The returned array is parallel to `boxes`.
 */
export function paginate(boxes: LayoutBox[], metrics: PageMetrics): number[] {
  const { band, gutter, margin } = metrics;
  const stride = band + gutter;
  const usable = band - margin * 2;
  const offsets = new Array<number>(boxes.length).fill(0);

  let push = 0;
  let i = 0;
  while (i < boxes.length) {
    // Collect the row: consecutive boxes that share a top (within rounding).
    const rowTop = boxes[i].top;
    let j = i;
    let rowBottom = boxes[i].top + boxes[i].height;
    while (j + 1 < boxes.length && Math.abs(boxes[j + 1].top - rowTop) <= 1) {
      j += 1;
      rowBottom = Math.max(rowBottom, boxes[j].top + boxes[j].height);
    }

    const rowHeight = rowBottom - rowTop;
    const top = rowTop + push;
    const pageIndex = Math.floor(top / stride);
    const contentBottom = pageIndex * stride + band - margin;

    if (rowHeight <= usable && top + rowHeight > contentBottom) {
      const delta = (pageIndex + 1) * stride + margin - top;
      push += delta;
      for (let k = i; k <= j; k += 1) offsets[k] = delta;
    }

    i = j + 1;
  }

  return offsets;
}
