import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SensesCard from '@/components/SensesCard.vue';

describe('SensesCard', () => {
  it('renders each sense as a list entry', () => {
    const wrapper = mount(SensesCard, {
      props: {
        senses: ['Passive Perception 16', 'Darkvision 120 ft.'],
      },
    });

    const items = wrapper.findAll('[data-senses] .senses__item');
    expect(items).toHaveLength(2);
    expect(wrapper.text()).toContain('Passive Perception 16');
    expect(wrapper.text()).toContain('Darkvision 120 ft.');
  });

  it('shows a placeholder when there are no senses', () => {
    const wrapper = mount(SensesCard, { props: { senses: [] } });
    expect(wrapper.text()).toContain('No special senses');
  });
});
