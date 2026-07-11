import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SensesCard from '@/components/cards/SensesCard.vue';

describe('SensesCard', () => {
  it('renders each sense with its label and value', () => {
    const wrapper = mount(SensesCard, {
      props: {
        senses: [
          { label: 'Passive Perception', value: '16' },
          { label: 'Darkvision', value: '120 ft.' },
        ],
      },
    });

    const items = wrapper.findAll('[data-senses] [data-sense]');
    expect(items).toHaveLength(2);
    expect(items[0].get('.senses__label').text()).toBe('Passive Perception');
    expect(items[0].get('.senses__value').text()).toBe('16');
    expect(items[1].get('.senses__value').text()).toBe('120 ft.');
  });

  it('shows a placeholder when there are no senses', () => {
    const wrapper = mount(SensesCard, { props: { senses: [] } });
    expect(wrapper.text()).toContain('No special senses');
  });
});
