import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ActionsCard from '@/components/cards/ActionsCard.vue';

describe('ActionsCard', () => {
  it('lists action names', () => {
    const wrapper = mount(ActionsCard, {
      props: {
        actions: [
          { name: 'Channel Divinity', category: 'action' },
          { name: 'Dagger', category: 'action' },
        ],
      },
    });

    expect(wrapper.findAll('[data-action]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Channel Divinity');
    expect(wrapper.text()).toContain('Dagger');
  });

  it('groups actions by category in a fixed order', () => {
    const wrapper = mount(ActionsCard, {
      props: {
        actions: [
          { name: 'Uncanny Dodge', category: 'reaction' },
          { name: 'Attack', category: 'action' },
          { name: 'Second Wind', category: 'bonus' },
          { name: 'Inspiration', category: 'other' },
        ],
      },
    });

    expect(wrapper.findAll('.actions__label').map((label) => label.text())).toEqual([
      'Action',
      'Bonus Action',
      'Reaction',
      'Other',
    ]);
    expect(wrapper.findAll('[data-action]')).toHaveLength(4);
  });
});
