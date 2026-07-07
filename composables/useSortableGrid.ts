import { onBeforeUnmount, watch, type Ref } from 'vue';
import Sortable from 'sortablejs';

interface SortableGridOptions {
  /** Called once the drop changes the order. */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Called continuously as the preview order changes (to re-run pagination). */
  onPreview?: () => void;
}

/**
 * Make the cards in `grid` drag-reorderable with SortableJS. Dragging starts
 * only from each card's `.card__drag-handle`; SortableJS shows its default drag
 * preview. Sibling cards animate to open the drop slot, and `onPreview` re-runs
 * pagination so that preview respects page breaks.
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
          handle: '.card__drag-handle',
          onChange: () => options.onPreview?.(),
          onEnd: () => options.onPreview?.(),
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
