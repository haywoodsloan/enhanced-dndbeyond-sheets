import { describe, expect, it } from 'vitest';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';
import { formatDamage } from '@/utils/character/format';

describe('action damage parity', () => {
  it.each([
    ['1d6 + 10', 10, '1d6+10 Radiant'],
    ['1d6 - 2', -2, '1d6-2 Radiant'],
    ['1d6', 10, '1d6+10 Radiant'],
  ])('counts fixed damage once: %s', (diceString, fixedValue, expected) => {
    const character = normalizeCharacter({
      id: 1, name: 'Damage fixture', stats: [], classes: [],
      actions: { class: [{
        name: 'Radiant pulse',
        damageTypeId: 12,
        dice: { diceString, fixedValue },
      }] },
    });
    expect(formatDamage(character.actions[0].damage).replace(/\s*([+-])\s*/g, '$1'))
      .toBe(expected);
  });

  it('preserves additional ability and action bonuses when fixed damage is already embedded', () => {
    const character = normalizeCharacter({
      id: 1, name: 'Damage fixture', stats: [{ id: 5, name: 'Wisdom', value: 18 }], classes: [],
      actions: { class: [{
        name: 'Radiant pulse', damageTypeId: 12, abilityModifierStatId: 5, damageBonus: 3,
        dice: { diceString: '1d6 + 10', fixedValue: 10 },
      }] },
    });
    expect(character.actions[0].damage).toMatchObject({ dice: '1d6 + 10', bonus: 7, type: 'Radiant' });
  });
});
