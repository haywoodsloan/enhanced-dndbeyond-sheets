import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AbilityScores from '@/components/AbilityScores.vue';
import type { AbilityScore } from '@/services/dndbeyond/model';

const abilities: AbilityScore[] = [
  { key: 'str', name: 'Strength', score: 15, modifier: 2 },
  { key: 'dex', name: 'Dexterity', score: 10, modifier: 0 },
  { key: 'con', name: 'Constitution', score: 14, modifier: 2 },
  { key: 'int', name: 'Intelligence', score: 12, modifier: 1 },
  { key: 'wis', name: 'Wisdom', score: 18, modifier: 4 },
  { key: 'cha', name: 'Charisma', score: 8, modifier: -1 },
];

describe('AbilityScores', () => {
  it('renders each ability with its name, modifier, and score', () => {
    const wrapper = mount(AbilityScores, { props: { abilities } });

    const tiles = wrapper.findAll('[data-ability]');
    expect(tiles).toHaveLength(6);
    expect(tiles.map((tile) => tile.attributes('data-ability'))).toEqual([
      'str',
      'dex',
      'con',
      'int',
      'wis',
      'cha',
    ]);

    const wis = wrapper.get('[data-ability="wis"]');
    expect(wis.text()).toContain('Wisdom');
    expect(wis.text()).toContain('+4');
    expect(wis.text()).toContain('18');

    const cha = wrapper.get('[data-ability="cha"]');
    expect(cha.text()).toContain('-1');
    expect(cha.text()).toContain('8');
  });

  it('arranges the tiles to stay square for the card aspect', () => {
    // Wide (2×1 card) → 3 columns; a 1-col-wide card → one full-width list column.
    const wide = mount(AbilityScores, { props: { abilities, cols: 2, rows: 1 } });
    expect(wide.get('.abilities').attributes('style')).toContain(
      'grid-template-columns: repeat(3, 1fr)',
    );
    expect(wide.find('.abilities--list').exists()).toBe(false);

    const tall = mount(AbilityScores, { props: { abilities, cols: 1, rows: 2 } });
    expect(tall.get('.abilities').attributes('style')).toContain(
      'grid-template-columns: repeat(1, 1fr)',
    );
    expect(tall.find('.abilities--list').exists()).toBe(true);
  });
});
