import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref, type Ref } from 'vue';
import { useCardDrag } from '@/composables/useCardDrag';
import { mountComposable } from '../fixtures/mount-composable';

type Cell = { page: number; col: number; row: number };
type OnPlace = (key: string, cell: Cell) => void;
type ResolveCell = (pointerPos: { x: number; y: number }, key: string) => Cell | null;

/** Build a grid element with one draggable card + handle in the document. */
function makeGrid(): HTMLElement {
  document.body.innerHTML = `
    <div id="grid">
      <div class="card" data-section-key="portrait">
        <span class="card__drag-handle"></span>
      </div>
    </div>`;
  return document.getElementById('grid') as HTMLElement;
}

const pointer = (type: string, init: MouseEventInit = {}) =>
  new MouseEvent(type, { bubbles: true, ...init });

describe('useCardDrag', () => {
  let onPlace: Mock<OnPlace>;
  let resolveCell: Mock<ResolveCell>;
  let grid: HTMLElement;
  let gridRef: Ref<HTMLElement | null>;

  beforeEach(() => {
    grid = makeGrid();
    gridRef = ref<HTMLElement | null>(grid);
    onPlace = vi.fn<OnPlace>();
    resolveCell = vi.fn<ResolveCell>(() => ({ page: 0, col: 1, row: 2 }));
  });

  afterEach(() => {
    // End any drag left armed/active so its document listeners don't leak.
    document.dispatchEvent(pointer('pointerup'));
  });

  const start = () => mountComposable(() => useCardDrag(gridRef, { onPlace, resolveCell }));
  const handle = () => grid.querySelector('.card__drag-handle') as HTMLElement;

  it('drags from the handle and places the card at the resolved cell', () => {
    start();
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    // Move past the 4px threshold → the drag starts and the card is placed.
    document.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));

    expect(document.querySelector('.card--drag-clone')).not.toBeNull();
    expect(resolveCell).toHaveBeenCalled();
    expect(onPlace).toHaveBeenCalledWith('portrait', { page: 0, col: 1, row: 2 });

    document.dispatchEvent(pointer('pointerup'));
    expect(document.querySelector('.card--drag-clone')).toBeNull();
  });

  it('does not start until the pointer passes the drag threshold', () => {
    start();
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 12, clientY: 11 })); // < 4px

    expect(document.querySelector('.card--drag-clone')).toBeNull();
    expect(onPlace).not.toHaveBeenCalled();
  });

  it('ignores a non-primary button and a grab away from the handle', () => {
    start();
    handle().dispatchEvent(pointer('pointerdown', { button: 2, clientX: 10, clientY: 10 }));
    grid.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 60 }));
    expect(onPlace).not.toHaveBeenCalled();
  });

  it('skips placement when the pointer resolves to no cell', () => {
    resolveCell.mockReturnValue(null);
    start();
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));
    expect(resolveCell).toHaveBeenCalled();
    expect(onPlace).not.toHaveBeenCalled();
  });

  it('cancels the drag on pointercancel and tears down on unmount', async () => {
    const { wrapper } = start();
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));
    document.dispatchEvent(pointer('pointercancel'));
    expect(document.querySelector('.card--drag-clone')).toBeNull();

    // A fresh grab after unmount does nothing (listener detached).
    wrapper.unmount();
    await flushPromises();
    onPlace.mockClear();
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));
    expect(onPlace).not.toHaveBeenCalled();
  });
});
