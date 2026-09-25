import { describe, expect, it } from 'vitest';
import type { RawCharacter, RawLevelScale } from '@/services/dndbeyond/api-types';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';

const martialArtsRules = 'You gain these benefits while you are unarmed or wielding only Monk weapons and you aren’t wearing armor or wielding a Shield. Monk weapons are Simple Melee weapons and Martial Melee weapons that have the Light property. You can use Dexterity instead of Strength for attack and damage rolls.';
const base: RawCharacter = {
  id: 1,
  name: 'Unarmed combat fixture',
  stats: [{ id: 1, name: null, value: 12 }, { id: 2, name: null, value: 18 }],
  classes: [{
    level: 20,
    definition: { name: 'Feature-based combatant' },
    classFeatures: [{
      definition: { id: 10, name: 'Martial Arts', requiredLevel: 1, description: martialArtsRules },
      levelScale: { level: 17, dice: { diceString: '1d12' } },
    }],
  }],
};
const unarmed = (raw: RawCharacter) =>
  normalizeCharacter(raw).attacks.find(({ name }) => name === 'Unarmed Strike');

describe('Martial Arts unarmed attack parity', () => {
  it('uses the granted Martial Arts die and Dexterity instead of the ordinary flat attack', () => {
    expect(unarmed(base)).toMatchObject({
      toHit: 10, damage: { dice: '1d12', bonus: 4, type: 'Bludgeoning' }, range: '5 ft.',
    });
  });

  it('keeps Strength when it is better than Dexterity', () => {
    expect(unarmed({
      ...base, stats: [{ id: 1, name: null, value: 20 }, { id: 2, name: null, value: 14 }],
    })).toMatchObject({ toHit: 11, damage: { dice: '1d12', bonus: 5 } });
  });

  it.each([1, 2, 3, 4])('uses ordinary unarmed combat with equipped armor/shield type %s', (armorTypeId) => {
    expect(unarmed({
      ...base,
      inventory: [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId } }],
    })).toMatchObject({ toHit: 7, damage: { dice: '', bonus: 2 } });
  });

  it('does not treat carried unequipped armor as worn', () => {
    expect(unarmed({
      ...base,
      inventory: [{ id: 1, equipped: false, definition: { filterType: 'Armor', armorTypeId: 3 } }],
    })).toMatchObject({ toHit: 10, damage: { dice: '1d12', bonus: 4 } });
  });

  it.each([
    ['2014', 5, '1d6', 7],
    ['2014', 20, '1d10', 10],
    ['2024', 5, '1d8', 7],
    ['2024', 20, '1d12', 10],
  ])('selects the source-provided %s scale at class level %s', (edition, level, dice, toHit) => {
    const levelScales: RawLevelScale[] = edition === '2014'
      ? [
          { level: 1, dice: { diceString: '1d4' } },
          { level: 5, dice: { diceString: '1d6' } },
          { level: 11, dice: { diceString: '1d8' } },
          { level: 17, dice: { diceString: '1d10' } },
        ]
      : [
          { level: 1, dice: { diceString: '1d6' } },
          { level: 5, dice: { diceString: '1d8' } },
          { level: 11, dice: { diceString: '1d10' } },
          { level: 17, dice: { diceString: '1d12' } },
        ];
    expect(unarmed({
      ...base,
      classes: [{ level: Number(level), definition: { classFeatures: [{
        id: 10, name: 'Martial Arts', requiredLevel: 1, description: martialArtsRules, levelScales,
      }] } }],
    })).toMatchObject({ toHit, damage: { dice, bonus: 4 } });
  });

  it('uses class level for the die but total level for proficiency when multiclassed', () => {
    expect(unarmed({
      ...base,
      classes: [{
        level: 1,
        definition: { classFeatures: [{
          name: 'Martial Arts', requiredLevel: 1, levelScales: [
            { level: 1, dice: { diceCount: 1, diceValue: 6 } },
            { level: 5, dice: { diceCount: 1, diceValue: 8 } },
          ],
        }] },
      }, { level: 19, definition: { name: 'Other' } }],
    })).toMatchObject({ toHit: 10, damage: { dice: '1d6', bonus: 4 } });
  });

  it('does not infer Martial Arts solely from the class name', () => {
    expect(unarmed({ ...base, classes: [{ level: 20, definition: { name: 'Monk' } }] }))
      .toMatchObject({ toHit: 7, damage: { dice: '', bonus: 2 } });
  });

  it('does not use a feature granted above the current class level', () => {
    expect(unarmed({
      ...base,
      classes: [{ level: 1, definition: { classFeatures: [{
        name: 'Martial Arts', requiredLevel: 3, levelScales: [{ level: 3, dice: { diceString: '1d8' } }],
      }] } }],
    })).toMatchObject({ toHit: 3, damage: { dice: '', bonus: 2 } });
  });

  it('uses the current granted scale rather than duplicating the catalog feature', () => {
    expect(unarmed({
      ...base,
      classes: [{
        ...base.classes[0],
        definition: { classFeatures: [{
          id: 10, name: 'Martial Arts', levelScales: [{ level: 1, dice: { diceString: '1d6' } }],
        }] },
      }],
    })).toMatchObject({ damage: { dice: '1d12', bonus: 4 } });
  });

  it('does not apply Martial Arts while wielding a non-Monk weapon', () => {
    expect(unarmed({
      ...base,
      inventory: [{ id: 1, equipped: true, definition: {
        name: 'Greatsword', filterType: 'Weapon', categoryId: 2, attackType: 1,
        properties: [{ name: 'Heavy' }, { name: 'Two-Handed' }],
      } }],
    })).toMatchObject({ toHit: 7, damage: { dice: '', bonus: 2 } });
  });

  it('retains Martial Arts while wielding a qualifying light martial melee weapon', () => {
    expect(unarmed({
      ...base,
      inventory: [{ id: 1, equipped: true, definition: {
        name: 'Scimitar', filterType: 'Weapon', categoryId: 2, attackType: 1,
        properties: [{ name: 'Light' }],
      } }],
    })).toMatchObject({ toHit: 10, damage: { dice: '1d12', bonus: 4 } });
  });
});
