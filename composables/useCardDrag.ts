import { onBeforeUnmount, watch, type Ref } from 'vue';
import { dropTargetIndex, type Rect } from '@/utils/card-drop';

interface CardDragOptions {
  /** Move the card at `fromIndex` to `toIndex` in the model (reflows the grid). */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Called after the preview order shifts (and on drop) to re-run pagination. */
  onDragMove?: () => void;
}

/** Distance (px) the pointer must travel before a grab becomes a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Bounding rects of the grid's card children, in document (model) order,
 * measured from layout offsets instead of getBoundingClientRect. The cards glide
 * to reordered slots via a CSS transform, and offsets ignore transforms, so the
 * drop slot is always resolved against the cards' resting positions rather than
 * their mid-animation ones (which would make the target oscillate).
 */
function cardRects(grid: HTMLElement): Rect[] {
  const gridRect = grid.getBoundingClientRect();
  const originLeft = gridRect.left - grid.offsetLeft;
  const originTop = gridRect.top - grid.offsetTop;
  return (Array.from(grid.children) as HTMLElement[]).map((child) => {
    const left = originLeft + child.offsetLeft;
    const top = originTop + child.offsetTop;
    return { left, top, right: left + child.offsetWidth, bottom: top + child.offsetHeight };
  });
}

/**
 * Pointer-driven drag-reordering for the section-card grid — a hand-rolled
 * replacement for SortableJS. It reorders the model LIVE as the pointer moves,
 * so the cards reflow to preview the drop even over the empty cells a partial
 * row leaves behind (which SortableJS can't target — it only swaps with a
 * sibling element directly under the pointer, so dropping beside a wider card
 * registered nothing and the card snapped back).
 *
 * On grab (from a card's `.card__drag-handle`) a fixed-position clone follows
 * the cursor while the real card is dimmed in place as a placeholder. Each move
 * resolves the drop slot from pointer geometry (`dropTargetIndex`, shared with
 * the drop tests) and, when it changes, calls `onReorder` to move the card
 * there — Vue re-renders the keyed grid, so the model stays the single source of
 * truth (no DOM/model desync) and the preview IS the real, paginated layout.
 *
 * The grid renders only once the character loads, so the `pointerdown` listener
 * is (re)attached whenever the element ref becomes available.
 */
export function useCardDrag(grid: Ref<HTMLElement | null>, options: CardDragOptions) {
  let source: HTMLElement | null = null;
  let clone: HTMLElement | null = null;
  let dragIndex = -1;
  let grabX = 0;
  let grabY = 0;
  let startX = 0;
  let startY = 0;
  let armed = false; // pointer is down on a handle but hasn't passed the threshold
  let dragging = false;

  function reset() {
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerUp, true);
    clone?.remove();
    clone = null;
    source?.classList.remove('card--drag-source');
    source = null;
    dragIndex = -1;
    armed = false;
    dragging = false;
  }

  function startDrag() {
    if (!source) return;
    dragging = true;
    armed = false;
    const rect = source.getBoundingClientRect();
    clone = source.cloneNode(true) as HTMLElement;
    clone.classList.add('card--drag-clone');
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      pointerEvents: 'none',
      zIndex: '1000',
    });
    document.body.appendChild(clone);
    source.classList.add('card--drag-source');
  }

  function onPointerMove(event: PointerEvent) {
    if (armed) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD) {
        return;
      }
      startDrag();
    }
    const element = grid.value;
    if (!dragging || !clone || !element) return;

    clone.style.left = `${event.clientX - grabX}px`;
    clone.style.top = `${event.clientY - grabY}px`;

    const pointer = { x: event.clientX, y: event.clientY };
    const to = dropTargetIndex(pointer, cardRects(element), dragIndex);
    if (to >= 0 && to !== dragIndex) {
      options.onReorder(dragIndex, to);
      dragIndex = to;
      options.onDragMove?.();
    }
  }

  function onPointerUp() {
    const wasDragging = dragging;
    reset();
    if (wasDragging) options.onDragMove?.();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || dragging || armed) return;
    const element = grid.value;
    if (!element) return;
    const handle = (event.target as HTMLElement).closest?.('.card__drag-handle');
    if (!handle) return;
    const card = handle.closest('.card') as HTMLElement | null;
    if (!card) return;
    const index = Array.from(element.children).indexOf(card);
    if (index < 0) return;

    event.preventDefault();
    source = card;
    dragIndex = index;
    const rect = card.getBoundingClientRect();
    grabX = event.clientX - rect.left;
    grabY = event.clientY - rect.top;
    startX = event.clientX;
    startY = event.clientY;
    armed = true;

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
  }

  watch(
    grid,
    (element, _previous, onCleanup) => {
      if (!element) return;
      element.addEventListener('pointerdown', onPointerDown);
      onCleanup(() => element.removeEventListener('pointerdown', onPointerDown));
    },
    { immediate: true },
  );

  onBeforeUnmount(reset);
}
