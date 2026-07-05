import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  abilityModifier,
  formatModifier,
  proficiencyBonus,
} from '@/utils/dnd5e';

describe('abilityModifier', () => {
  it('applies floor((score - 10) / 2)', () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(12)).toBe(1);
    expect(abilityModifier(15)).toBe(2);
    expect(abilityModifier(18)).toBe(4);
    expect(abilityModifier(20)).toBe(5);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(7)).toBe(-2);
    expect(abilityModifier(1)).toBe(-5);
  });
});

describe('proficiencyBonus', () => {
  it('scales +2 to +6 across levels 1-20', () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(4)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(8)).toBe(3);
    expect(proficiencyBonus(9)).toBe(4);
    expect(proficiencyBonus(12)).toBe(4);
    expect(proficiencyBonus(13)).toBe(5);
    expect(proficiencyBonus(16)).toBe(5);
    expect(proficiencyBonus(17)).toBe(6);
    expect(proficiencyBonus(20)).toBe(6);
  });

  it('clamps out-of-range levels', () => {
    expect(proficiencyBonus(0)).toBe(2);
    expect(proficiencyBonus(25)).toBe(6);
  });
});

describe('formatModifier', () => {
  it('always shows a sign', () => {
    expect(formatModifier(2)).toBe('+2');
    expect(formatModifier(0)).toBe('+0');
    expect(formatModifier(-1)).toBe('-1');
    expect(formatModifier(5)).toBe('+5');
  });
});

describe('ABILITIES', () => {
  it('lists the six abilities in canonical order', () => {
    expect(ABILITIES.map((ability) => ability.key)).toEqual([
      'str',
      'dex',
      'con',
      'int',
      'wis',
      'cha',
    ]);
    expect(ABILITIES.map((ability) => ability.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
