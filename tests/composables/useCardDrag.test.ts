import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref, type Ref } from 'vue';
import { useCardDrag, type CardMoveDirection } from '@/composables/useCardDrag';
import { mountComposable } from '../fixtures/mount-composable';

type Cell = { page: number; col: number; row: number };
type OnPlace = (key: string, cell: Cell) => void;
type OnMove = (key: string, direction: CardMoveDirection) => void;
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
  let onMove: Mock<OnMove>;
  let resolveCell: Mock<ResolveCell>;
  let grid: HTMLElement;
  let gridRef: Ref<HTMLElement | null>;

  beforeEach(() => {
    grid = makeGrid();
    gridRef = ref<HTMLElement | null>(grid);
    onPlace = vi.fn<OnPlace>();
    onMove = vi.fn<OnMove>();
    resolveCell = vi.fn<ResolveCell>(() => ({ page: 0, col: 1, row: 2 }));
  });

  afterEach(() => {
    // End any drag left armed/active so its document listeners don't leak.
    document.dispatchEvent(pointer('pointerup'));
  });

  const start = () =>
    mountComposable(() => useCardDrag(gridRef, { onPlace, onMove, resolveCell }));
  const handle = () => grid.querySelector('.card__drag-handle') as HTMLElement;

  it('drags from the handle and places the card at the resolved cell', () => {
    start();
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    // Move past the 4px threshold → the drag starts and the card is placed.
    document.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));

    expect(document.querySelector('.card--drag-clone')).not.toBeNull();
    expect(resolveCell).toHaveBeenCalled();
    expect(onPlace).toHaveBeenCalledWith('portrait', { page: 0, col: 1, row: 2 });

    document.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 55 }));
    expect(resolveCell).toHaveBeenLastCalledWith({ x: 50, y: 55 }, 'portrait');

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

  it('ignores pointer movement before a grab and malformed drag targets', () => {
    start();
    document.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));

    const text = document.createTextNode('not an element');
    grid.appendChild(text);
    text.dispatchEvent(pointer('pointerdown', { button: 0 }));

    grid.innerHTML = '<span class="card__drag-handle"></span>';
    handle().dispatchEvent(pointer('pointerdown', { button: 0 }));

    grid.innerHTML = '<div class="card"><span class="card__drag-handle"></span></div>';
    handle().dispatchEvent(pointer('pointerdown', { button: 0 }));

    expect(resolveCell).not.toHaveBeenCalled();
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

  it('moves a card in every direction with unmodified arrow keys from its handle', () => {
    start();
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      handle().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    expect(onMove.mock.calls).toEqual([
      ['portrait', 'up'],
      ['portrait', 'down'],
      ['portrait', 'left'],
      ['portrait', 'right'],
    ]);
  });

  it('ignores modified arrows, unrelated keys, and events away from a handle', () => {
    start();
    handle().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true }),
    );
    handle().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, bubbles: true }),
    );
    handle().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', metaKey: true, bubbles: true }),
    );
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(onMove).not.toHaveBeenCalled();
  });

  it('ignores keyboard handles without a keyed card', () => {
    grid.innerHTML = '<span class="card__drag-handle"></span>';
    start();
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    grid.innerHTML = '<div class="card"><span class="card__drag-handle"></span></div>';
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(onMove).not.toHaveBeenCalled();
  });

  it('ignores another pointer grab while one is armed or dragging', () => {
    start();
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));
    handle().dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));

    expect(document.querySelectorAll('.card--drag-clone')).toHaveLength(1);
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

  it('strips the section-key identity from the drag clone and its descendants', () => {
    document.body.innerHTML = `
      <div id="grid">
        <div class="card" data-section-key="portrait">
          <span class="card__drag-handle"></span>
          <span data-section-key="portrait" class="nested"></span>
        </div>
      </div>`;
    const gridEl = document.getElementById('grid') as HTMLElement;
    const localRef = ref<HTMLElement | null>(gridEl);
    mountComposable(() => useCardDrag(localRef, { onPlace, onMove, resolveCell }));

    const handleEl = gridEl.querySelector('.card__drag-handle') as HTMLElement;
    handleEl.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 40 }));

    const clone = document.querySelector('.card--drag-clone');
    expect(clone).not.toBeNull();
    // A visual copy only — no `[data-section-key]` on the clone root OR any child,
    // so a global lookup never sees two cards with the same key mid-drag.
    expect(clone!.hasAttribute('data-section-key')).toBe(false);
    expect(clone!.querySelector('[data-section-key]')).toBeNull();
    document.dispatchEvent(pointer('pointerup'));
  });
});
