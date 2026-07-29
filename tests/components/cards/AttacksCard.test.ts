import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AttacksCard from '@/components/cards/AttacksCard.vue';
import type { Attack } from '@/services/dndbeyond/model';

describe('AttacksCard', () => {
  it('renders each attack with a signed to-hit, damage, and range', () => {
    const attacks: Attack[] = [
      {
        name: 'Morningstar',
        toHit: 4,
        damage: { dice: '1d8', bonus: 2, type: 'Piercing' },
        range: '5 ft.',
        properties: [
          { name: 'Sap', description: 'Disadvantage on its next attack.', mastered: true },
        ],
      },
    ];
    const wrapper = mount(AttacksCard, { props: { attacks } });

    expect(wrapper.findAll('[data-attack]')).toHaveLength(1);
    const text = wrapper.text();
    expect(text).toContain('Morningstar');
    expect(text).toContain('+4');
    expect(text).toContain('1d8+2 Piercing');
    expect(text).toContain('5 ft.');
    expect(text).toContain('Sap');
    // The property is defined once in the legend beneath the table.
    expect(text).toContain('Disadvantage on its next attack.');
  });

  it('shows a save prompt when an attack is save-based instead of a to-hit', () => {
    const attacks: Attack[] = [
      { name: 'Fire Breath', save: 'DC 14 DEX', damage: { dice: '3d6', type: 'Fire' } },
    ];
    const wrapper = mount(AttacksCard, { props: { attacks } });
    const text = wrapper.text();
    expect(text).toContain('DC 14 DEX');
    expect(text).toContain('3d6 Fire');
  });

  it('renders flat-only damage without a dice expression', () => {
    const attacks: Attack[] = [
      { name: 'Unarmed Strike', toHit: 4, damage: { dice: '', bonus: 3, type: 'Bludgeoning' } },
    ];
    const wrapper = mount(AttacksCard, { props: { attacks } });
    expect(wrapper.text()).toContain('3 Bludgeoning');
  });

  it('lists only the properties that appear, once each, in the legend', () => {
    const attacks: Attack[] = [
      {
        name: 'Dagger',
        toHit: 5,
        damage: { dice: '1d4', bonus: 3, type: 'Piercing' },
        range: '20/60 ft.',
        properties: [
          { name: 'Finesse', description: 'Use Strength or Dexterity.' },
          { name: 'Light', description: 'Allows two-weapon fighting.' },
        ],
      },
      {
        name: 'Shortsword',
        toHit: 5,
        damage: { dice: '1d6', bonus: 3, type: 'Piercing' },
        range: '5 ft.',
        // Finesse repeats (deduped); Thrown has no description (omitted).
        properties: [
          { name: 'Finesse', description: 'Use Strength or Dexterity.' },
          { name: 'Thrown' },
        ],
      },
    ];
    const wrapper = mount(AttacksCard, { props: { attacks } });

    const terms = wrapper.findAll('.attacks__legend dt').map((dt) => dt.text());
    expect(terms).toEqual(['Finesse', 'Light']);
    expect(wrapper.text()).toContain('Use Strength or Dexterity.');
    expect(wrapper.text()).toContain('Allows two-weapon fighting.');
  });

  it('greys unavailable masteries and omits their rules from the legend', () => {
    const attacks: Attack[] = [
      {
        name: 'Scimitar',
        toHit: 5,
        damage: { dice: '1d6', bonus: 3, type: 'Slashing' },
        range: '5 ft.',
        properties: [
          { name: 'Finesse', description: 'Use Strength or Dexterity.' },
          {
            name: 'Nick',
            description: 'Make the extra Light attack as part of the Attack action.',
            mastered: false,
          },
        ],
      },
    ];
    const wrapper = mount(AttacksCard, { props: { attacks } });

    const notes = wrapper.find('.attacks__notes').text();
    expect(notes).toContain('Nick');
    expect(notes).toContain('Finesse');
    expect(notes).not.toContain('*');
    expect(wrapper.get('.attacks__note-item--unavailable').text()).toContain('Nick');
    expect(wrapper.get('.attacks__note-item--unavailable').attributes('title')).toBe(
      'Requires mastery with this weapon',
    );

    const terms = wrapper.findAll('.attacks__legend dt').map((dt) => dt.text());
    expect(terms).toEqual(['Finesse']);
    expect(wrapper.text()).not.toContain('Make the extra Light attack');
    expect(wrapper.find('[data-mastery-note]').exists()).toBe(false);
  });

  it('defines a selected mastery normally in the property legend', () => {
    const attacks: Attack[] = [
      {
        name: 'Dagger',
        properties: [
          {
            name: 'Nick',
            description: 'Make the extra Light attack as part of the Attack action.',
            mastered: true,
          },
        ],
      },
    ];
    const wrapper = mount(AttacksCard, { props: { attacks } });

    expect(wrapper.find('.attacks__note-item--unavailable').exists()).toBe(false);
    expect(wrapper.get('.attacks__legend dt').text()).toBe('Nick');
    expect(wrapper.text()).toContain('Make the extra Light attack');
    expect(wrapper.text()).not.toContain('*');
  });
});
