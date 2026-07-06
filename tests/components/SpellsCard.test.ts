import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SpellsCard from '@/components/SpellsCard.vue';

describe('SpellsCard', () => {
  it('groups spells by level', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [
          { name: 'Guidance', level: 0 },
          { name: 'Bless', level: 1 },
        ],
      },
    });

    const cantrips = wrapper.get('[data-level="0"]');
    expect(cantrips.text()).toContain('Cantrips');
    expect(cantrips.text()).toContain('Guidance');

    const first = wrapper.get('[data-level="1"]');
    expect(first.text()).toContain('Level 1');
    expect(first.text()).toContain('Bless');
  });
});
