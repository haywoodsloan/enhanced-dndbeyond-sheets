import { describe, expect, it } from 'vitest';
import { defaultSectionOrder } from '@/utils/layout/section-order';
import {
  SECTION_KEYS,
  type Character,
  type CharacterSection,
  type SectionKey,
} from '@/services/dndbeyond/model';
import { makeCharacter as buildCharacter } from '../../fixtures/character';

function makeCharacter(
  classes: { name: string; level: number }[],
  emptyKeys: SectionKey[] = [],
): Character {
  const empties = new Set(emptyKeys);
  const sections: CharacterSection[] = SECTION_KEYS.map((key) => {
    const isEmpty = empties.has(key);
    return { key, title: key, count: isEmpty ? 0 : 1, isEmpty };
  });
  return buildCharacter({
    classes: classes.map((cls) => ({ name: cls.name, level: cls.level })),
    level: classes.reduce((sum, cls) => sum + cls.level, 0),
    sections,
  });
}

const orderedKeys = (character: Character) =>
  defaultSectionOrder(character).map((section) => section.key);

describe('defaultSectionOrder', () => {
  it('puts skills, saves, and proficiencies before spells for a full caster', () => {
    expect(orderedKeys(makeCharacter([{ name: 'Cleric', level: 4 }]))).toEqual([
      'basics',
      'attributes',
      'portrait',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'spells',
      'actions',
      'attacks',
      'features',
      'inventory',
      'wealth',
      'notes',
    ]);
  });

  it('leads with attacks then actions, spells after, for a martial class', () => {
    expect(orderedKeys(makeCharacter([{ name: 'Fighter', level: 5 }]))).toEqual([
      'basics',
      'attributes',
      'portrait',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'attacks',
      'actions',
      'spells',
      'features',
      'inventory',
      'wealth',
      'notes',
    ]);
  });

  it('leads with attacks then spells for a half-caster', () => {
    expect(orderedKeys(makeCharacter([{ name: 'Paladin', level: 6 }]))).toEqual([
      'basics',
      'attributes',
      'portrait',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'attacks',
      'spells',
      'actions',
      'features',
      'inventory',
      'wealth',
      'notes',
    ]);
  });

  it('moves empty sections to the end', () => {
    // A wizard with no actions available: actions drops past its usual slot.
    expect(
      orderedKeys(makeCharacter([{ name: 'Wizard', level: 3 }], ['actions'])),
    ).toEqual([
      'basics',
      'attributes',
      'portrait',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'spells',
      'attacks',
      'features',
      'inventory',
      'wealth',
      'notes',
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
      'portrait',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'attacks',
      'actions',
      'spells',
      'features',
      'inventory',
      'wealth',
      'notes',
    ]);
  });

  it('falls back to the martial layout when the character has no classes', () => {
    const character = buildCharacter({
      classes: [],
      level: 0,
      sections: SECTION_KEYS.map((key) => ({ key, title: key, count: 1, isEmpty: false })),
    });
    const order = orderedKeys(character);
    // Martial style keeps actions ahead of spells.
    expect(order.indexOf('actions')).toBeLessThan(order.indexOf('spells'));
  });

  it('sorts sections with an unknown key to the end, keeping their order', () => {
    const character = buildCharacter({
      classes: [{ name: 'Fighter', level: 1 }],
      level: 1,
      sections: [
        { key: 'mystery-a' as SectionKey, title: 'A', count: 1, isEmpty: false },
        { key: 'basics', title: 'Basics', count: 1, isEmpty: false },
        { key: 'mystery-b' as SectionKey, title: 'B', count: 1, isEmpty: false },
      ],
    });
    expect(orderedKeys(character)).toEqual(['basics', 'mystery-a', 'mystery-b']);
  });
});
