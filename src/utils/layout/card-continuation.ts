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
  /** Body-relative px to translate the card body up by (0 for the first slice). */
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
export function continuationBaseKey(key: CardKey): CardKey {
  return key.replace(CONTINUATION_RE, '') as CardKey;
}

/**
 * Split a content-fit card's measured body into page-tall slices, breaking at
 * item boundaries so no item is cut. `breaks` are item-bottom offsets
 * (body-relative, ascending, the last ≈ `total`); `maxHeight` is the body height
 * that fits one page's card. Returns a single full slice when it all fits.
 */
export function sliceContent(breaks: number[], total: number, maxHeight: number): CardSlice[] {
  if (!(maxHeight > 0) || total <= maxHeight) return [{ offset: 0, height: total }];
  const sorted = [...breaks].filter((value) => value > 0).sort((a, b) => a - b);
  const slices: CardSlice[] = [];
  let start = 0;
  let guard = 0;
  while (start < total - 0.5 && guard < 1000) {
    guard += 1;
    const limit = start + maxHeight;
    // The last item boundary that fits within this page from `start`.
    let end = 0;
    for (const boundary of sorted) {
      if (boundary > start + 0.5 && boundary <= limit + 0.5) end = boundary;
    }
    if (end <= start) {
      // No boundary fits (a single item taller than a page): take the next one so
      // that item gets its own — necessarily overflowing — card and we progress.
      end = sorted.find((boundary) => boundary > start + 0.5) ?? total;
    }
    slices.push({ offset: start, height: end - start });
    start = end;
  }
  // Make sure the last item reaches the content end.
  const last = slices[slices.length - 1];
  if (last && last.offset + last.height < total - 0.5) {
    const offset = last.offset + last.height;
    slices.push({ offset, height: total - offset });
  }
  return slices;
}
