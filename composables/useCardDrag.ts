import { onBeforeUnmount, watch, type Ref } from 'vue';

interface CardDragOptions {
  /** Move the card at `fromIndex` to `toIndex` in the model (reflows the grid). */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Pin the card at `fromIndex` to a specific cell (manual placement). */
  onPlace?: (fromIndex: number, cell: { page: number; col: number; row: number }) => void;
  /** Resolve the model index the dragged card should move to for the pointer's
   * position (-1 for no reorder slot). */
  resolveDrop: (pointer: { x: number; y: number }, fromIndex: number) => number;
  /** Resolve a manual-placement cell when there's no reorder slot under the
   * pointer (null = leave as-is). */
  resolvePlace?: (
    pointer: { x: number; y: number },
    fromIndex: number,
  ) => { page: number; col: number; row: number } | null;
}

/** Distance (px) the pointer must travel before a grab becomes a drag. */
const DRAG_THRESHOLD = 4;

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
 * asks `resolveDrop` for the model index the card should take for the pointer's
 * position (it simulates the packer, so it lands in the empty cells beside a
 * tall card) and, when it changes, calls `onReorder` to move the card there —
 * Vue re-renders the keyed grid, so the model stays the single source of truth
 * (no DOM/model desync) and the preview IS the real, paginated layout.
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
    if (!dragging || !clone) return;

    clone.style.left = `${event.clientX - grabX}px`;
    clone.style.top = `${event.clientY - grabY}px`;

    const pointer = { x: event.clientX, y: event.clientY };
    const to = options.resolveDrop(pointer, dragIndex);
    if (to >= 0 && to !== dragIndex) {
      options.onReorder(dragIndex, to);
      dragIndex = to;
    } else if (to < 0 && options.resolvePlace && options.onPlace) {
      // No reorder slot under the pointer — try a manual placement into a cell.
      const cell = options.resolvePlace(pointer, dragIndex);
      if (cell) options.onPlace(dragIndex, cell);
    }
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
    // The cards live in per-page grid containers, so find the model index among
    // all cards in the sheet (DOM order == model order) rather than among direct
    // children of one grid.
    const index = Array.from(element.querySelectorAll('[data-section-key]')).indexOf(card);
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
