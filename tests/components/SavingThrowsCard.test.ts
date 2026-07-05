import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SavingThrowsCard from '@/components/SavingThrowsCard.vue';
import type { SavingThrow } from '@/services/dndbeyond/model';

const saves: SavingThrow[] = [
  { key: 'str', name: 'Strength', modifier: 2, proficient: false },
  { key: 'dex', name: 'Dexterity', modifier: 0, proficient: false },
  { key: 'con', name: 'Constitution', modifier: 2, proficient: false },
  { key: 'int', name: 'Intelligence', modifier: 1, proficient: false },
  { key: 'wis', name: 'Wisdom', modifier: 6, proficient: true },
  { key: 'cha', name: 'Charisma', modifier: 1, proficient: true },
];

describe('SavingThrowsCard', () => {
  it('renders each save with its modifier and proficiency marker', () => {
    const wrapper = mount(SavingThrowsCard, { props: { saves } });

    const rows = wrapper.findAll('[data-save]');
    expect(rows).toHaveLength(6);

    const wis = wrapper.get('[data-save="wis"]');
    expect(wis.text()).toContain('Wisdom');
    expect(wis.text()).toContain('+6');
    expect(wis.find('.save__prof--on').exists()).toBe(true);

    const str = wrapper.get('[data-save="str"]');
    expect(str.text()).toContain('+2');
    expect(str.find('.save__prof--on').exists()).toBe(false);
  });
});
