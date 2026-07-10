import { onBeforeUnmount, watch, type Ref } from 'vue';

interface CardDragOptions {
  /** Place the dragged card (by section key) at a specific cell. */
  onPlace: (key: string, cell: { page: number; col: number; row: number }) => void;
  /** Resolve the cell the dragged card should move to for the pointer's position
   * (null = no change, e.g. it already sits there). */
  resolveCell: (
    pointer: { x: number; y: number },
    key: string,
  ) => { page: number; col: number; row: number } | null;
}

/** Distance (px) the pointer must travel before a grab becomes a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Pointer-driven drag PLACEMENT for the section-card grid — a hand-rolled
 * replacement for SortableJS. Every card has a cell, and dragging moves the
 * card's cell LIVE as the pointer moves, so the layout reflows to preview the
 * drop even over empty cells (which SortableJS can't target — it only swaps with
 * a sibling directly under the pointer).
 *
 * On grab (from a card's `.card__drag-handle`) a fixed-position clone follows
 * the cursor while the real card is dimmed in place. Each move asks `resolveCell`
 * for the cell under the pointer and, when it changes, calls `onPlace(key, cell)`
 * to move that card there — Vue re-renders the keyed grid, so the model stays the
 * single source of truth and the preview IS the real, paginated layout.
 *
 * The grid renders only once the character loads, so the `pointerdown` listener
 * is (re)attached whenever the element ref becomes available.
 */
export function useCardDrag(grid: Ref<HTMLElement | null>, options: CardDragOptions) {
  let source: HTMLElement | null = null;
  let clone: HTMLElement | null = null;
  let draggedKey: string | null = null;
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
    draggedKey = null;
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
    if (!dragging || !clone) return;

    clone.style.left = `${event.clientX - grabX}px`;
    clone.style.top = `${event.clientY - grabY}px`;

    if (!draggedKey) return;
    const cell = options.resolveCell({ x: event.clientX, y: event.clientY }, draggedKey);
    if (cell) options.onPlace(draggedKey, cell);
  }

  function onPointerUp() {
    reset();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || dragging || armed) return;
    const element = grid.value;
    if (!element) return;
    const handle = (event.target as HTMLElement).closest?.('.card__drag-handle');
    if (!handle) return;
    const card = handle.closest('.card') as HTMLElement | null;
    if (!card) return;
    const key = card.dataset.sectionKey;
    if (!key) return;

    event.preventDefault();
    source = card;
    draggedKey = key;
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
