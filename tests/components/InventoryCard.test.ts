import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import InventoryCard from '@/components/InventoryCard.vue';

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
});
