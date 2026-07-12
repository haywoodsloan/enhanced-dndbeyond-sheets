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
    // Slots sit at the start of their level: 1st (4) + 2nd (3) = 7 boxes total.
    expect(wrapper.findAll('[data-slots]')).toHaveLength(2);
    expect(wrapper.findAll('.resource__box')).toHaveLength(7);
  });

  it('omits the header and slots for a non-caster', () => {
    const wrapper = mount(SpellsCard, {
      props: { spells: [{ name: 'Guidance', level: 0 }] },
    });
    expect(wrapper.find('[data-spellcasting]').exists()).toBe(false);
    expect(wrapper.find('[data-slots]').exists()).toBe(false);
  });

  it('renders per-spell shorthand, damage, and a concentration tag', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [
          {
            name: 'Fire Bolt',
            level: 0,
            castingTime: 'A',
            range: '120 ft.',
            components: 'V, S',
            attack: true,
            damage: { dice: '1d10', type: 'Fire' },
          },
          {
            name: 'Bless',
            level: 1,
            castingTime: 'A',
            range: '30 ft.',
            concentration: true,
            duration: 'Conc, 1 min',
          },
        ],
      },
    });

    const spells = wrapper.findAll('[data-spell]');
    expect(spells).toHaveLength(2);
    expect(spells[0].text()).toContain('Fire Bolt');
    expect(spells[0].text()).toContain('1d10 Fire');
    expect(spells[0].text()).toContain('Spell atk');
    // The concentration spell shows a "C" tag.
    expect(spells[1].text()).toContain('C');
  });

  it('renders a spell summary blurb when present', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [
          { name: 'Guidance', level: 0, summary: 'You touch a creature and add 1d4 to a check.' },
          { name: 'Message', level: 0 },
        ],
      },
    });
    const spells = wrapper.findAll('[data-spell]');
    expect(spells[0].find('.spells__summary').text()).toBe(
      'You touch a creature and add 1d4 to a check.',
    );
    expect(spells[1].find('.spells__summary').exists()).toBe(false);
  });
});
