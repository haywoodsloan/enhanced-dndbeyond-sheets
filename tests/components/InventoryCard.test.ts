import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import InventoryCard from '@/components/InventoryCard.vue';

describe('InventoryCard', () => {
  it('lists items with quantity and equipped/attuned tags', () => {
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
    expect(wrapper.text()).toContain('equipped');
    expect(wrapper.text()).toContain('×3');
  });
});
