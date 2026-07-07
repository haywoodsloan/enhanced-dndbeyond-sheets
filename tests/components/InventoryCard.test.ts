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
    // Circles are labeled once in the column header, not per item.
    expect(wrapper.text()).toContain('Equipped');
    expect(wrapper.text()).toContain('Attuned');
    // Only Plate is equipped → exactly one filled circle across both items.
    expect(wrapper.findAll('.item__dot--on')).toHaveLength(1);
  });
});
