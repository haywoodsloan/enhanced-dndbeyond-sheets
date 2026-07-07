import { onBeforeUnmount, watch, type Ref } from 'vue';
import Sortable from 'sortablejs';

/**
 * Make the cards in `grid` drag-reorderable with SortableJS. Dragging starts
 * only from each card's `.card__drag-handle`; SortableJS shows its default drag
 * preview and sibling cards animate to open the drop slot. `onReorder(from, to)`
 * fires once the drop changes the order.
 *
 * `fallbackOnBody` appends the drag clone to `<body>` so it isn't offset by a
 * positioned ancestor (otherwise the preview drifts from the cursor). A lower
 * `swapThreshold` plus `invertSwap` let the dragged card claim a slot even next
 * to a full-width (3-col) card.
 *
 * The grid renders only after the character loads, so we (re)create the instance
 * whenever the element ref becomes available rather than on mount.
 */
export function useSortableGrid(
  grid: Ref<HTMLElement | null>,
  onReorder: (fromIndex: number, toIndex: number) => void,
) {
  let sortable: Sortable | null = null;

  function destroy() {
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
          swapThreshold: 0.65,
          invertSwap: true,
          handle: '.card__drag-handle',
          onUpdate: (event) => {
            const { oldIndex, newIndex } = event;
            if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
            onReorder(oldIndex, newIndex);
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
