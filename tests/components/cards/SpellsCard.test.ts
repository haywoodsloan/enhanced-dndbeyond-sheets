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
        spellcasting: {
          profiles: [{ source: 'Cleric', ability: 'WIS', modifier: 4, attack: 6, saveDc: 14 }],
          slots: [4, 3],
        },
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

  it('shows Pact Magic as a separate short-rest pool at its slot level', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [{ name: 'Hunger of Hadar', level: 3 }],
        spellcasting: {
          profiles: [
            { source: 'Warlock', ability: 'CHA', modifier: 4, attack: 7, saveDc: 15 },
          ],
          slots: [],
          pactSlots: [{ source: 'Warlock', level: 3, max: 2 }],
        },
      },
    });

    const third = wrapper.get('[data-level="3"]');
    const pact = third.get('[data-pact-slots]');
    expect(pact.text()).toContain('Pact');
    expect(pact.text()).toContain('short rest');
    expect(pact.findAll('.resource__box')).toHaveLength(2);
    expect(third.find('[data-slots]').exists()).toBe(false);
  });

  it('shows separate multiclass casting profiles and each spell ability', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [
          { name: 'Sacred Flame', level: 0, ability: 'WIS' },
          { name: 'Fire Bolt', level: 0, ability: 'INT' },
        ],
        spellcasting: {
          profiles: [
            { source: 'Cleric', ability: 'WIS', modifier: 3, attack: 6, saveDc: 14 },
            { source: 'Wizard', ability: 'INT', modifier: 4, attack: 7, saveDc: 15 },
          ],
          slots: [4, 3],
        },
      },
    });

    const profiles = wrapper.findAll('[data-spellcasting-profile]');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].text()).toContain('Cleric');
    expect(profiles[0].text()).toContain('WIS');
    expect(profiles[1].text()).toContain('Wizard');
    expect(profiles[1].text()).toContain('INT');
    expect(wrapper.findAll('[data-spell]').map((spell) => spell.text())).toEqual(
      expect.arrayContaining([expect.stringContaining('WIS'), expect.stringContaining('INT')]),
    );
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
          {
            name: 'Sacred Flame',
            level: 0,
            castingTime: 'A',
            range: '60 ft.',
            save: 'DEX',
          },
        ],
      },
    });

    const spells = wrapper.findAll('[data-spell]');
    expect(spells).toHaveLength(3);
    expect(spells[0].text()).toContain('Fire Bolt');
    expect(spells[0].text()).toContain('1d10 Fire');
    expect(spells[0].text()).toContain('Spell attack');
    expect(spells[1].text()).toContain('DEX save');
    // The concentration spell shows a "C" tag.
    expect(spells[2].text()).toContain('C');
  });

  it('shows concentration and ritual as separate boxes', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [{ name: 'Detect Magic', level: 1, concentration: true, ritual: true }],
      },
    });

    const tags = wrapper.findAll('[data-spell] .spells__spell-tag');
    expect(tags.map((tag) => tag.text())).toEqual(['C', 'R']);
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

  it('renders structured spell options as an actual list', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [
          {
            name: 'Command',
            level: 1,
            summary: 'Choose a command.',
            list: {
              items: [
                { label: 'Approach.', text: 'The target moves toward you.' },
                { label: 'Drop.', text: 'The target drops what it holds.' },
              ],
            },
          },
        ],
      },
    });

    const list = wrapper.get('[data-spell-list]');
    expect(list.get('ul').element.tagName).toBe('UL');
    expect(list.get('ul').classes()).toContain('structured-list__items--plain');
    expect(list.findAll('li').every((item) => item.classes().includes('structured-list__item'))).toBe(
      true,
    );
    expect(list.findAll('li')).toHaveLength(2);
    expect(list.findAll('[data-structured-list-item]').map((item) => item.text())).toEqual([
      'Approach.The target moves toward you.',
      'Drop.The target drops what it holds.',
    ]);
  });

  it('shows each sourced feature-cast tracker next to its spell', () => {
    const wrapper = mount(SpellsCard, {
      props: {
        spells: [
          {
            name: 'Augury',
            level: 1,
            featureUses: [
              {
                source: 'Gathered Whispers',
                pool: { max: 1, recovery: { kind: 'rest', rest: 'long' } },
              },
              {
                source: 'Second Sight',
                pool: { max: 2, recovery: { kind: 'rest', rest: 'short' } },
              },
            ],
          },
          { name: 'Bless', level: 1 },
        ],
      },
    });
    const spells = wrapper.findAll('[data-spell]');
    const uses = spells[0].findAll('[data-spell-use]');
    expect(uses).toHaveLength(2);
    expect(uses[0].text()).toContain('Gathered Whispers:');
    expect(uses[0].findAll('.resource__box')).toHaveLength(1);
    expect(uses[0].text()).toContain('Long rest');
    expect(uses[1].text()).toContain('Second Sight:');
    expect(uses[1].findAll('.resource__box')).toHaveLength(2);
    expect(uses[1].text()).toContain('short rest');
    // A spell without a feature grant shows no tracker.
    expect(spells[1].find('[data-spell-use]').exists()).toBe(false);
  });
});
