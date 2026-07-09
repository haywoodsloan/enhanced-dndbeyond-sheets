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
 * Honors `prefers-reduced-motion`: when set, cards simply snap (no glide).
 */
export function useGridFlip(container: Ref<HTMLElement | null>, order: WatchSource) {
  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Positions captured just before the re-render, keyed by the card element
  // (Vue reuses the keyed elements across a reorder, so they match up).
  let first: Map<Element, DOMRect> | null = null;
  const wired = new WeakSet<Element>();

  function cards(): HTMLElement[] {
    const element = container.value;
    return element ? Array.from(element.querySelectorAll<HTMLElement>('.card')) : [];
  }

  function clearOnEnd(event: Event) {
    const card = event.currentTarget as HTMLElement;
    card.style.transition = '';
    card.style.transform = '';
  }

  function capture() {
    if (reduceMotion) return;
    const rects = new Map<Element, DOMRect>();
    // getBoundingClientRect (visual) so a card interrupted mid-glide starts its
    // next glide from where it currently appears, not where it will rest.
    for (const card of cards()) rects.set(card, card.getBoundingClientRect());
    first = rects;
  }

  function play() {
    if (!first) return;
    const before = first;
    first = null;
    const list = cards();

    // Clear any in-flight transform and read each card's RESTING rect, so the
    // glide is measured against the true new layout (not a mid-animation offset)
    // and works even when a card moved between page containers.
    const after = new Map<Element, DOMRect>();
    for (const card of list) {
      card.style.transition = 'none';
      card.style.transform = '';
      after.set(card, card.getBoundingClientRect());
    }

    const moved: HTMLElement[] = [];
    for (const card of list) {
      const from = before.get(card);
      if (!from) continue; // a card that just appeared — nothing to glide from
      const to = after.get(card)!;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) continue;
      // Invert: place the card back at its old spot with no transition.
      card.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(card);
    }
    if (!moved.length) return;

    // Play: on the next frame, transition the inverse offset back to zero.
    requestAnimationFrame(() => {
      for (const card of moved) {
        if (!wired.has(card)) {
          card.addEventListener('transitionend', clearOnEnd);
          wired.add(card);
        }
        card.style.transition = `transform ${DURATION}ms ${EASING}`;
        card.style.transform = '';
      }
    });
  }

  // Capture positions before Vue patches the DOM, play the FLIP afterwards.
  watch(order, capture, { flush: 'pre' });
  watch(order, play, { flush: 'post' });

  onBeforeUnmount(() => {
    for (const card of cards()) card.removeEventListener('transitionend', clearOnEnd);
  });
}
