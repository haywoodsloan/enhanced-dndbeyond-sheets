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

  it('renders resource checkboxes and a damage/save/range meta line', () => {
    const wrapper = mount(ActionsCard, {
      props: {
        actions: [
          {
            name: 'Divine Spark',
            category: 'action',
            resource: { max: 2, recharge: 'LR' },
            damage: { dice: '1d8', bonus: 4 },
            save: 'DC 14 CON',
            range: '30 ft.',
          },
        ],
      },
    });

    const item = wrapper.get('[data-action]');
    expect(item.text()).toContain('Divine Spark');
    expect(item.findAll('.resource__box')).toHaveLength(2);
    expect(item.text()).toContain('1d8+4');
    expect(item.text()).toContain('DC 14 CON');
    expect(item.text()).toContain('30 ft.');
  });

  it('renders an action summary blurb when present', () => {
    const wrapper = mount(ActionsCard, {
      props: {
        actions: [
          {
            name: 'Channel Divinity',
            category: 'action',
            summary: 'Channel divine energy to fuel effects.',
          },
          { name: 'Dash', category: 'action' },
        ],
      },
    });
    const items = wrapper.findAll('[data-action]');
    expect(items[0].find('.actions__summary').text()).toBe(
      'Channel divine energy to fuel effects.',
    );
    // An action without a summary shows no blurb line.
    expect(items[1].find('.actions__summary').exists()).toBe(false);
  });
});
