import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import InventoryCard from '@/components/cards/InventoryCard.vue';

describe('InventoryCard', () => {
  it('lists items with quantity and labeled equipped/attuned circles', () => {
    const wrapper = mount(InventoryCard, {
      props: {
        inventory: [
          { name: 'Plate', quantity: 1, equipped: true, attuned: false },
          { name: 'Potion of Healing', quantity: 3, equipped: false, attuned: false },
        ],
      },
    });

    expect(wrapper.findAll('[data-item]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Plate');
    expect(wrapper.text()).toContain('×3');
    // Circles are labeled once in the column header (abbreviated; full word on hover).
    const labels = wrapper.findAll('.column__label');
    expect(labels[0].text()).toBe('Equip');
    expect(labels[0].attributes('title')).toBe('Equipped');
    expect(labels[1].text()).toBe('Attune');
    expect(labels[1].attributes('title')).toBe('Attuned');
    // Only Plate is equipped → exactly one filled circle across both items.
    expect(wrapper.findAll('.item__dot--on')).toHaveLength(1);
  });

  it('splits items into the requested number of columns', () => {
    const inventory = Array.from({ length: 6 }, (_, index) => ({
      name: `Item ${index}`,
      quantity: 1,
      equipped: false,
      attuned: false,
    }));

    const twoCol = mount(InventoryCard, { props: { inventory, columns: 2 } });
    expect(twoCol.findAll('.column')).toHaveLength(2);

    const oneCol = mount(InventoryCard, { props: { inventory, columns: 1 } });
    expect(oneCol.findAll('.column')).toHaveLength(1);

    // Defaults to three balanced columns when no count is given.
    const threeCol = mount(InventoryCard, { props: { inventory } });
    expect(threeCol.findAll('.column')).toHaveLength(3);
  });

  it('reflows write-in rows when the requested column count changes', async () => {
    const inventory = Array.from({ length: 4 }, (_, index) => ({
      name: `Item ${index}`,
      quantity: 1,
      equipped: false,
      attuned: false,
    }));
    const wrapper = mount(InventoryCard, { props: { inventory, columns: 1 } });

    await wrapper.setProps({ columns: 2 });
    await nextTick();

    expect(wrapper.findAll('.column')).toHaveLength(2);
    expect(wrapper.findAll('[data-item-blank]')).toHaveLength(4);
  });

  it('adds blank write-in rows without counting them as items or filled circles', () => {
    const wrapper = mount(InventoryCard, {
      props: {
        inventory: [{ name: 'Plate', quantity: 1, equipped: true, attuned: false }],
      },
    });

    // A single-column list gets two blank rows; they aren't real items or dots.
    expect(wrapper.findAll('[data-item-blank]')).toHaveLength(2);
    expect(wrapper.findAll('[data-item]')).toHaveLength(1);
    expect(wrapper.findAll('.item__dot--on')).toHaveLength(1);
  });

  it('splits write-in rows across columns, fewer per column at three columns', () => {
    const inventory = Array.from({ length: 6 }, (_, index) => ({
      name: `Item ${index}`,
      quantity: 1,
      equipped: false,
      attuned: false,
    }));

    // Two columns → 2 blank rows each (4 total); three columns → 1 each (3).
    const twoCol = mount(InventoryCard, { props: { inventory, columns: 2 } });
    expect(twoCol.findAll('[data-item-blank]')).toHaveLength(4);

    const threeCol = mount(InventoryCard, { props: { inventory, columns: 3 } });
    expect(threeCol.findAll('[data-item-blank]')).toHaveLength(3);
  });

  it('fills each column with extra write-in rows measured from the laid-out card', async () => {
    const inventory = Array.from({ length: 6 }, (_, index) => ({
      name: `Item ${index}`,
      quantity: 1,
      equipped: false,
      attuned: false,
    }));

    // happy-dom has no layout, so feed measure() geometry: a tall column with a
    // sentinel partway down leaves spare height for many write-in rows.
    const gbcr = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const bottom = this.classList?.contains('column')
          ? 400
          : this.classList?.contains('column__sentinel')
            ? 100
            : this.classList?.contains('item__name--blank')
              ? 150
              : 0;
        return { bottom, top: 0, left: 0, right: 0, width: 0, height: bottom, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      });
    class FakeResizeObserver {
      constructor(_callback: () => void) {}
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts = { ready: Promise.resolve() };

    const wrapper = mount(InventoryCard, { props: { inventory, columns: 2 } });
    await flushPromises();
    await nextTick();

    // measure() computed extra rows from the spare height (well past the base 2/col).
    expect(wrapper.findAll('[data-item-blank]').length).toBeGreaterThan(8);

    wrapper.unmount(); // disconnects the ResizeObserver
    gbcr.mockRestore();
    vi.unstubAllGlobals();
    delete (document as unknown as { fonts?: unknown }).fonts;
  });
});
