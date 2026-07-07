import { onBeforeUnmount, watch, type Ref } from 'vue';
import Sortable from 'sortablejs';
import { dropTargetIndex, type Rect } from '@/utils/card-drop';

interface SortableGridOptions {
  /** Called once the drop changes the order. */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Called as the preview order shifts during a drag (to re-run pagination). */
  onDragMove?: () => void;
}

/** Bounding rects of the grid's card children, in document (model) order. */
function cardRects(grid: HTMLElement): Rect[] {
  return Array.from(grid.children).map((child) => {
    const rect = child.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
}

/**
 * Make the cards in `grid` drag-reorderable with SortableJS. Dragging starts
 * only from each card's `.card__drag-handle`; SortableJS shows its default drag
 * preview and sibling cards animate to open the drop slot. `onReorder(from, to)`
 * fires once the drop changes the order; `onDragMove` fires as the preview shifts
 * (used to re-paginate so the preview respects page breaks).
 *
 * `fallbackOnBody` appends the drag clone to `<body>` so it isn't offset by a
 * positioned ancestor (otherwise the preview drifts from the cursor).
 *
 * SortableJS only reorders by swapping with a sibling card under the pointer, so
 * dropping into one of the empty cells a partial row leaves behind registers no
 * change and the card snaps back. To fix that we track the pointer during the
 * drag and, when the drop produced no swap, resolve the target slot from where
 * the pointer was released (`dropTargetIndex`) so the card lands in the open cell.
 *
 * The grid renders only after the character loads, so we (re)create the instance
 * whenever the element ref becomes available rather than on mount.
 */
export function useSortableGrid(grid: Ref<HTMLElement | null>, options: SortableGridOptions) {
  let sortable: Sortable | null = null;
  let swapped = false;
  let pointer: { x: number; y: number } | null = null;

  function trackPointer(event: PointerEvent) {
    pointer = { x: event.clientX, y: event.clientY };
  }

  function destroy() {
    document.removeEventListener('pointermove', trackPointer, true);
    sortable?.destroy();
    sortable = null;
  }

  watch(
    grid,
    (element) => {
      destroy();
      if (!element) return;
      try {
        sortable = Sortable.create(element, {
          animation: 160,
          forceFallback: true,
          fallbackOnBody: true,
          handle: '.card__drag-handle',
          onStart: () => {
            swapped = false;
            pointer = null;
            document.addEventListener('pointermove', trackPointer, true);
          },
          onChange: () => options.onDragMove?.(),
          onUpdate: (event) => {
            const { oldIndex, newIndex } = event;
            if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
            swapped = true;
            options.onReorder(oldIndex, newIndex);
          },
          onEnd: (event) => {
            document.removeEventListener('pointermove', trackPointer, true);
            options.onDragMove?.();
            // SortableJS didn't find a sibling to swap with (e.g. the drop was
            // over an empty cell) — place the card where the pointer was released.
            if (!swapped && pointer && event.oldIndex != null) {
              const to = dropTargetIndex(pointer, cardRects(element), event.oldIndex);
              if (to >= 0) options.onReorder(event.oldIndex, to);
            }
            swapped = false;
            pointer = null;
          },
        });
      } catch {
        // SortableJS needs a real DOM (skipped in unit tests / SSR).
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(destroy);
}
