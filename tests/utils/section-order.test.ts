import { describe, expect, it } from 'vitest';
import { defaultSectionOrder } from '@/utils/section-order';
import {
  SECTION_KEYS,
  type Character,
  type CharacterSection,
  type SectionKey,
} from '@/services/dndbeyond/model';

function makeCharacter(
  classes: { name: string; level: number }[],
  emptyKeys: SectionKey[] = [],
): Character {
  const empties = new Set(emptyKeys);
  const sections: CharacterSection[] = SECTION_KEYS.map((key) => {
    const isEmpty = empties.has(key);
    return { key, title: key, count: isEmpty ? 0 : 1, isEmpty };
  });
  return {
    id: 1,
    name: 'Test',
    classes: classes.map((cls) => ({ name: cls.name, level: cls.level })),
    level: classes.reduce((sum, cls) => sum + cls.level, 0),
    sections,
  };
}

const orderedKeys = (character: Character) =>
  defaultSectionOrder(character).map((section) => section.key);

describe('defaultSectionOrder', () => {
  it('leads with spells for a full caster', () => {
    expect(orderedKeys(makeCharacter([{ name: 'Cleric', level: 4 }]))).toEqual([
      'basics',
      'attributes',
      'spells',
      'actions',
      'savingThrows',
      'skills',
      'features',
      'proficiencies',
      'inventory',
      'wealth',
    ]);
  });

  it('leads with actions for a martial class', () => {
    expect(orderedKeys(makeCharacter([{ name: 'Fighter', level: 5 }]))).toEqual([
      'basics',
      'attributes',
      'actions',
      'savingThrows',
      'skills',
      'features',
      'inventory',
      'proficiencies',
      'wealth',
      'spells',
    ]);
  });

  it('interleaves actions and spells for a half-caster', () => {
    expect(orderedKeys(makeCharacter([{ name: 'Paladin', level: 6 }]))).toEqual([
      'basics',
      'attributes',
      'actions',
      'spells',
      'savingThrows',
      'skills',
      'features',
      'inventory',
      'proficiencies',
      'wealth',
    ]);
  });

  it('moves empty sections to the end', () => {
    // A wizard with no actions available: actions drops past its usual slot.
    expect(
      orderedKeys(makeCharacter([{ name: 'Wizard', level: 3 }], ['actions'])),
    ).toEqual([
      'basics',
      'attributes',
      'spells',
      'savingThrows',
      'skills',
      'features',
      'proficiencies',
      'inventory',
      'wealth',
      'actions',
    ]);
  });

  it('uses the highest-level class to pick the style in a multiclass', () => {
    expect(
      orderedKeys(
        makeCharacter([
          { name: 'Wizard', level: 2 },
          { name: 'Fighter', level: 10 },
        ]),
      ),
    ).toEqual([
      'basics',
      'attributes',
      'actions',
      'savingThrows',
      'skills',
      'features',
      'inventory',
      'proficiencies',
      'wealth',
      'spells',
    ]);
  });
});
