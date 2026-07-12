import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  abilityModifier,
  armorClass,
  cantripDiceMultiplier,
  CONDITION_NAMES,
  conditionName,
  formatModifier,
  maxHitPoints,
  proficiencyBonus,
} from '@/utils/character/dnd5e';

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

describe('armorClass', () => {
  it('applies the Dex rule for each armor category', () => {
    expect(armorClass({ category: 'none', dexModifier: 3 })).toBe(13);
    expect(armorClass({ category: 'light', armorBase: 11, dexModifier: 3 })).toBe(14);
    expect(armorClass({ category: 'medium', armorBase: 14, dexModifier: 3 })).toBe(16);
    expect(armorClass({ category: 'heavy', armorBase: 18, dexModifier: 3 })).toBe(18);
  });

  it('adds shield and flat bonuses', () => {
    expect(
      armorClass({ category: 'heavy', armorBase: 18, dexModifier: 0, shieldBonus: 2 }),
    ).toBe(20);
    expect(
      armorClass({ category: 'none', dexModifier: 2, shieldBonus: 2, bonus: 1 }),
    ).toBe(15);
  });
});

describe('maxHitPoints', () => {
  it('adds the Con modifier per level to the base', () => {
    expect(maxHitPoints({ base: 23, conModifier: 2, level: 4 })).toBe(31);
    expect(maxHitPoints({ base: 10, conModifier: 1, level: 2, bonus: 4 })).toBe(16);
  });

  it('honors an explicit override', () => {
    expect(
      maxHitPoints({ base: 23, conModifier: 2, level: 4, override: 50 }),
    ).toBe(50);
  });
});

describe('conditionName', () => {
  it('maps known ids and ignores the rest', () => {
    expect(conditionName(1)).toBe('Blinded');
    expect(conditionName(11)).toBe('Poisoned');
    expect(conditionName(15)).toBe('Unconscious');
    expect(conditionName(99)).toBeUndefined();
    expect(conditionName(undefined)).toBeUndefined();
  });

  it('lists all conditions in canonical order', () => {
    expect(CONDITION_NAMES).toHaveLength(15);
    expect(CONDITION_NAMES[0]).toBe('Blinded');
    expect(CONDITION_NAMES[CONDITION_NAMES.length - 1]).toBe('Unconscious');
    expect(CONDITION_NAMES).toContain('Poisoned');
  });
});

describe('cantripDiceMultiplier', () => {
  it('scales at levels 5, 11, and 17', () => {
    expect(cantripDiceMultiplier(1)).toBe(1);
    expect(cantripDiceMultiplier(4)).toBe(1);
    expect(cantripDiceMultiplier(5)).toBe(2);
    expect(cantripDiceMultiplier(10)).toBe(2);
    expect(cantripDiceMultiplier(11)).toBe(3);
    expect(cantripDiceMultiplier(17)).toBe(4);
    expect(cantripDiceMultiplier(20)).toBe(4);
  });
});
