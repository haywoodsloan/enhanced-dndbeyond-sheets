import { onBeforeUnmount, watch, type Ref } from 'vue';
import Sortable from 'sortablejs';

/**
 * Make the cards in `grid` drag-reorderable with SortableJS. Uses the forced
 * fallback so dragging works via pointer events (reliable everywhere) and shows
 * a floating clone; sibling cards animate to open a slot where the dragged card
 * will land. `onReorder(from, to)` fires once the drop changes the order.
 *
 * The grid is rendered only after the character loads, so we (re)create the
 * instance whenever the element ref becomes available rather than on mount.
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
          // Don't start a drag from interactive controls (e.g. the Basics
          // checkboxes) but still let them receive the click.
          filter: 'input, a, button, label',
          preventOnFilter: false,
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          fallbackClass: 'sortable-fallback',
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
