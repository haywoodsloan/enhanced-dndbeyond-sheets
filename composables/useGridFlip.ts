import { onBeforeUnmount, watch, type Ref, type WatchSource } from 'vue';

/** How long a card takes to glide from its old slot to its new one. */
const DURATION = 220;
/** Decelerating curve so cards ease into place rather than stopping abruptly. */
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';
/** Ignore sub-pixel "moves" (rounding noise) so unmoved cards don't animate. */
const EPSILON = 0.5;

/**
 * FLIP-animate the section cards so they glide to their new grid slots when the
 * order changes — during a drag-reorder or when a section is hidden/shown —
 * instead of snapping. Each card's position is recorded before Vue re-renders
 * the grid (First), the inverse offset is applied on the new layout so it still
 * appears at the old spot (Invert), then transitioned away on the next frame
 * (Play).
 *
 * Only the CSS `transform` is animated. The drag hit-testing (`useCardDrag`) and
 * the pagination (`useSheetPagination`) both measure the cards from their layout
 * offsets, which a `transform` doesn't move — so an in-flight glide never skews
 * the drop slot or the page-break math.
 *
 * Honors `prefers-reduced-motion`: when set, cards simply snap (no glide).
 */
export function useGridFlip(grid: Ref<HTMLElement | null>, order: WatchSource) {
  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Positions captured just before the grid re-renders, keyed by the card
  // element (Vue reuses the keyed elements across a reorder, so they match up).
  let first: Map<Element, DOMRect> | null = null;
  const wired = new WeakSet<Element>();

  function clearOnEnd(event: Event) {
    const card = event.currentTarget as HTMLElement;
    card.style.transition = '';
    card.style.transform = '';
  }

  function capture() {
    const element = grid.value;
    if (!element || reduceMotion) return;
    const rects = new Map<Element, DOMRect>();
    for (const child of Array.from(element.children)) {
      // getBoundingClientRect (visual) so a card interrupted mid-glide starts
      // its next glide from where it currently appears, not where it will rest.
      rects.set(child, child.getBoundingClientRect());
    }
    first = rects;
  }

  function play() {
    const element = grid.value;
    if (!element || !first) return;
    const previous = first;
    first = null;

    // The grid never carries a transform, so its rect is a stable origin from
    // which each child's resting viewport position can be rebuilt from offsets.
    const gridRect = element.getBoundingClientRect();
    const originLeft = gridRect.left - element.offsetLeft;
    const originTop = gridRect.top - element.offsetTop;

    const moved: HTMLElement[] = [];
    for (const child of Array.from(element.children) as HTMLElement[]) {
      const before = previous.get(child);
      if (!before) continue; // a card that just appeared — nothing to glide from
      const afterLeft = originLeft + child.offsetLeft;
      const afterTop = originTop + child.offsetTop;
      const dx = before.left - afterLeft;
      const dy = before.top - afterTop;
      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) continue;
      // Invert: place the card back at its old spot with no transition.
      child.style.transition = 'none';
      child.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(child);
    }
    if (!moved.length) return;

    // Play: on the next frame, transition the inverse offset back to zero.
    requestAnimationFrame(() => {
      for (const child of moved) {
        if (!wired.has(child)) {
          child.addEventListener('transitionend', clearOnEnd);
          wired.add(child);
        }
        child.style.transition = `transform ${DURATION}ms ${EASING}`;
        child.style.transform = '';
      }
    });
  }

  // Capture positions before Vue patches the DOM, play the FLIP afterwards.
  watch(order, capture, { flush: 'pre' });
  watch(order, play, { flush: 'post' });

  onBeforeUnmount(() => {
    const element = grid.value;
    if (!element) return;
    for (const child of Array.from(element.children)) {
      child.removeEventListener('transitionend', clearOnEnd);
    }
  });
}
