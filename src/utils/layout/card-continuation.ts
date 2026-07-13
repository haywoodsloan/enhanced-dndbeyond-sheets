import type { CardKey } from '@/services/dndbeyond/model';

/**
 * A content-fit card's measured geometry, reported by `SectionCard` so the sheet
 * can size the card to its text and split an over-tall one across continuations.
 */
export interface CardMeasurement {
  /** Card top to body top (title + padding above the content), px. */
  chrome: number;
  /** The body's natural content height, px. */
  total: number;
  /** Item-bottom offsets (body-relative, ascending) a slice may end on. */
  breaks: number[];
}

/**
 * A vertical slice of a content-fit card's body when it's too tall for one page
 * and continues on a follow-up "(cont.)" card.
 */
export interface CardSlice {
  /** First item index shown on this slice's card (inclusive). */
  start: number;
  /** One past the last item index shown (exclusive); `breaks.length` for the last. */
  end: number;
  /** Body-relative px offset of the slice's top (its first item's top, 0 first). */
  offset: number;
  /** The body content height (px) this slice shows. */
  height: number;
}

const CONTINUATION_RE = /~cont~(\d+)$/;

/** The card key for the Nth continuation of a base card (`<base>~cont~<n>`). */
export function continuationKey(base: CardKey, index: number): CardKey {
  return `${base}~cont~${index}` as CardKey;
}

/** True when a key is a synthetic continuation ("(cont.)") card. */
export function isContinuationKey(key: CardKey | string): boolean {
  return typeof key === 'string' && CONTINUATION_RE.test(key);
}

/** The base card key a continuation belongs to (unchanged for non-continuations). */
export function continuationBaseKey(key: CardKey | string): CardKey {
  return key.replace(CONTINUATION_RE, '') as CardKey;
}

/**
 * Partition a content-fit card's measured body into page-tall slices at ITEM
 * boundaries — each slice is a whole run of items, so no item is ever split.
 * `breaks` are the item-bottom offsets (body-relative, ascending, the last ≈
 * `total`); `maxHeight` is the body height that fits one page's card. Each slice
 * carries both its ITEM INDEX RANGE `[start, end)` (which the card clips to using
 * its own live item positions, so the cut always lands on a real item edge) and
 * a pixel `offset`/`height` (which the sheet uses to size the card's footprint).
 * Returns a single full slice when it all fits or there are no item boundaries.
 */
export function sliceContent(breaks: number[], total: number, maxHeight: number): CardSlice[] {
  const sorted = [...breaks].filter((value) => value > 0).sort((a, b) => a - b);
  const count = sorted.length;
  if (!(maxHeight > 0) || total <= maxHeight || count === 0) {
    return [{ start: 0, end: count, offset: 0, height: total }];
  }
  const slices: CardSlice[] = [];
  let start = 0;
  let offset = 0;
  let guard = 0;
  while (start < count && guard < 1000) {
    guard += 1;
    const limit = offset + maxHeight;
    // Take every whole item whose bottom still fits under this page's limit.
    let end = start;
    while (end < count && sorted[end] <= limit + 0.5) end += 1;
    // Always take at least one item, even one taller than a page on its own.
    if (end === start) end += 1;
    const bottom = end >= count ? total : sorted[end - 1];
    slices.push({ start, end, offset, height: bottom - offset });
    start = end;
    offset = bottom;
  }
  // The last slice always runs to the content's end.
  const last = slices[slices.length - 1];
  if (last && last.offset + last.height < total - 0.5) {
    last.end = count;
    last.height = total - last.offset;
  }
  return slices;
}
