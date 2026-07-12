import { onBeforeUnmount, watch, type Ref, type WatchSource } from 'vue';

/** How long a card takes to glide from its old slot to its new one. */
const DURATION = 220;
/** Decelerating curve so cards ease into place rather than stopping abruptly. */
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';
/** Ignore sub-pixel "moves" (rounding noise) so unmoved cards don't animate. */
const EPSILON = 0.5;

/**
 * FLIP-animate the section cards so they glide to their new slots when the order
 * changes — a drag-reorder or hiding/showing a section — instead of snapping.
 * Each card's position is recorded before Vue re-renders (First), the inverse
 * offset is applied on the new layout so it still appears at the old spot
 * (Invert), then transitioned away on the next frame (Play).
 *
 * `container` is the wrapper that holds every page's grid; the cards are found
 * by querying `.card` descendants, so a card gliding from one page container to
 * another still animates (positions are read in viewport coordinates, which are
 * container-agnostic). A card's own layout toggle is deliberately NOT animated
 * (it isn't part of the `order` source): the resized card would snap while its
 * neighbours glided, which looks disjointed, so a layout change reflows at once.
 *
 * Only the CSS `transform` is animated, and the drag hit-testing (`useCardDrag`)
 * computes drop slots from the packer geometry, not from the cards' live rects,
 * so an in-flight glide never skews the drop target.
 *
 * Honors `prefers-reduced-motion`: when set, cards simply snap (no glide). The
 * optional `isSuppressed` predicate turns the glide off on demand — used during
 * an active drag so the live reflow snaps instantly (cards flow out of the way
 * immediately) rather than gliding a step behind the cursor.
 */
export function useGridFlip(
  container: Ref<HTMLElement | null>,
  order: WatchSource,
  isSuppressed?: () => boolean,
  options?: { selector?: string; key?: (element: HTMLElement) => string | undefined },
) {
  const selector = options?.selector ?? '.card';
  const keyOf = options?.key ?? ((element: HTMLElement) => element.dataset.sectionKey);
  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Positions captured just before the re-render, keyed by each element's stable
  // id (NOT the element itself): an element that is unmounted+remounted (e.g. a
  // card moving to another page's grid) would be missed if matched by element —
  // the stable key pairs the old position with the new element.
  let first: Map<string, DOMRect> | null = null;
  const wired = new WeakSet<Element>();

  function items(): HTMLElement[] {
    const element = container.value;
    return element ? Array.from(element.querySelectorAll<HTMLElement>(selector)) : [];
  }

  function clearOnEnd(event: Event) {
    const element = event.currentTarget as HTMLElement;
    element.style.transition = '';
    element.style.transform = '';
  }

  function capture() {
    if (reduceMotion || isSuppressed?.()) return;
    const rects = new Map<string, DOMRect>();
    // getBoundingClientRect (visual) so an element interrupted mid-glide starts
    // its next glide from where it currently appears, not where it will rest.
    for (const element of items()) {
      const key = keyOf(element);
      if (key) rects.set(key, element.getBoundingClientRect());
    }
    first = rects;
  }

  function play() {
    if (!first) return;
    const before = first;
    first = null;
    const list = items();

    // Clear any in-flight transform and read each element's RESTING rect, so the
    // glide is measured against the true new layout (not a mid-animation offset)
    // and works even when an element moved between containers.
    const after = new Map<Element, DOMRect>();
    for (const element of list) {
      element.style.transition = 'none';
      element.style.transform = '';
      after.set(element, element.getBoundingClientRect());
    }

    const moved: HTMLElement[] = [];
    for (const element of list) {
      const key = keyOf(element);
      const from = key ? before.get(key) : undefined;
      if (!from) continue; // an element that just appeared — nothing to glide from
      const to = after.get(element)!;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) continue;
      // Invert: place the element back at its old spot with no transition.
      element.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(element);
    }
    if (!moved.length) return;

    // Play: on the next frame, transition the inverse offset back to zero.
    requestAnimationFrame(() => {
      for (const element of moved) {
        if (!wired.has(element)) {
          element.addEventListener('transitionend', clearOnEnd);
          wired.add(element);
        }
        element.style.transition = `transform ${DURATION}ms ${EASING}`;
        element.style.transform = '';
      }
    });
  }

  // Capture positions before Vue patches the DOM, play the FLIP afterwards.
  watch(order, capture, { flush: 'pre' });
  watch(order, play, { flush: 'post' });

  onBeforeUnmount(() => {
    for (const element of items()) element.removeEventListener('transitionend', clearOnEnd);
  });
}
