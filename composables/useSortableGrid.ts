import { onBeforeUnmount, watch, type Ref } from 'vue';
import Sortable from 'sortablejs';

interface SortableGridOptions {
  /** Called once the drop changes the order. */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Called as the preview order shifts during a drag (to re-run pagination). */
  onDragMove?: () => void;
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
 * The grid renders only after the character loads, so we (re)create the instance
 * whenever the element ref becomes available rather than on mount.
 */
export function useSortableGrid(grid: Ref<HTMLElement | null>, options: SortableGridOptions) {
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
          handle: '.card__drag-handle',
          onChange: () => options.onDragMove?.(),
          onEnd: () => options.onDragMove?.(),
          onUpdate: (event) => {
            const { oldIndex, newIndex } = event;
            if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
            options.onReorder(oldIndex, newIndex);
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
