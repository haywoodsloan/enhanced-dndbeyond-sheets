import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RuleTablesCard from '@/components/cards/RuleTablesCard.vue';

describe('RuleTablesCard', () => {
  it('renders roll ranges and effects as individually breakable rows', () => {
    const wrapper = mount(RuleTablesCard, {
      props: {
        tables: [
          {
            title: 'Experimental Elixir',
            source: 'Experimental Elixir',
            columns: ['d6', 'Effect'],
            rows: [
              ['1', 'Healing. Regain 2d4 hit points.'],
              ['2', 'Swiftness. Speed increases by 10 feet.'],
            ],
          },
        ],
      },
    });

    expect(wrapper.get('[data-rule-table]').text()).toContain('Experimental Elixir');
    expect(wrapper.find('.rule-table__source').exists()).toBe(false);
    expect(wrapper.text()).toContain('Healing');
    expect(wrapper.findAll('[data-rule-row]')).toHaveLength(4);
  });

  it('supports a single roll column', () => {
    const wrapper = mount(RuleTablesCard, {
      props: {
        tables: [
          {
            title: 'Wild Result',
            source: 'Wild Magic',
            columns: ['d20'],
            rows: [['1-20']],
          },
        ],
      },
    });

    expect(wrapper.get('.rule-table__row').attributes('style')).toContain(
      'minmax(0, 1fr)',
    );
    expect(wrapper.get('.rule-table__source').text()).toBe('Wild Magic');
  });
});
