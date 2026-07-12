import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SpellsCard from '@/components/cards/SpellsCard.vue';

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

  it('shows the spellcasting header and per-level slot checkboxes', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [{ name: 'Guidance', level: 0 }],
        spellcasting: { ability: 'WIS', modifier: 4, attack: 6, saveDc: 14, slots: [4, 3] },
      },
    });

    const header = wrapper.get('[data-spellcasting]');
    expect(header.text()).toContain('+6');
    expect(header.text()).toContain('DC 14');
    expect(header.text()).toContain('WIS');
    // 1st-level (4) + 2nd-level (3) = 7 empty slot boxes.
    expect(wrapper.get('[data-slots]').findAll('.resource__box')).toHaveLength(7);
  });

  it('omits the header and slots for a non-caster', () => {
    const wrapper = mount(SpellsCard, {
      props: { spells: [{ name: 'Guidance', level: 0 }] },
    });
    expect(wrapper.find('[data-spellcasting]').exists()).toBe(false);
    expect(wrapper.find('[data-slots]').exists()).toBe(false);
  });
});
