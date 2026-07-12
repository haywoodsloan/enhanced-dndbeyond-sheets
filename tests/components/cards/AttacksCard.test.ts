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
        notes: ['Sap'],
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
});
