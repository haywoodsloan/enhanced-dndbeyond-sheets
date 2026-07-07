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
 * only from each card's `.card__drag-handle`. SortableJS's own fallback clone is
 * hidden; instead we render a shrunken clone that we position at the cursor on
 * every pointer move, so the preview tracks the mouse exactly (a CSS transform
 * on SortableJS's clone drifts as you drag further). Sibling cards animate to
 * open the drop slot, and `onPreview` re-runs pagination so that preview
 * respects page breaks.
 *
 * The grid renders only after the character loads, so we (re)create the instance
 * whenever the element ref becomes available rather than on mount.
 */
export function useSortableGrid(grid: Ref<HTMLElement | null>, options: SortableGridOptions) {
  let sortable: Sortable | null = null;
  let preview: HTMLElement | null = null;

  function positionPreview(clientX: number, clientY: number) {
    if (!preview) return;
    preview.style.left = `${clientX}px`;
    preview.style.top = `${clientY}px`;
  }

  function onPointerMove(event: MouseEvent | TouchEvent) {
    const point = 'touches' in event ? event.touches[0] : event;
    if (point) positionPreview(point.clientX, point.clientY);
  }

  function clearPreview() {
    document.removeEventListener('mousemove', onPointerMove, true);
    document.removeEventListener('touchmove', onPointerMove, true);
    preview?.remove();
    preview = null;
  }

  function destroy() {
    clearPreview();
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
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          fallbackClass: 'sortable-fallback',
          onStart: (event) => {
            const item = event.item as HTMLElement;
            const clone = item.cloneNode(true) as HTMLElement;
            clone.classList.add('card-drag-preview');
            clone.style.width = `${item.offsetWidth}px`;
            clone.style.height = `${item.offsetHeight}px`;
            preview = clone;
            document.body.appendChild(clone);
            const origin = (event as { originalEvent?: Event }).originalEvent as
              | MouseEvent
              | TouchEvent
              | undefined;
            const point = origin && 'touches' in origin ? origin.touches[0] : origin;
            if (point) positionPreview(point.clientX, point.clientY);
            document.addEventListener('mousemove', onPointerMove, true);
            document.addEventListener('touchmove', onPointerMove, true);
          },
          onChange: () => options.onPreview?.(),
          onEnd: () => {
            clearPreview();
            options.onPreview?.();
          },
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
