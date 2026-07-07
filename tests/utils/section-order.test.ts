import { describe, expect, it } from 'vitest';
import {
  applySavedOrder,
  defaultSectionOrder,
  moveSectionByIndex,
  moveVisibleByIndex,
} from '@/utils/section-order';
import {
  SECTION_KEYS,
  type Character,
  type CharacterSection,
  type SectionKey,
} from '@/services/dndbeyond/model';
import { makeCharacter as buildCharacter } from '../fixtures/character';

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
      'wealth',
      'spells',
      'actions',
      'features',
      'inventory',
      'notes',
    ]);
  });

  it('puts checks before actions with spells last for a martial class', () => {
    expect(orderedKeys(makeCharacter([{ name: 'Fighter', level: 5 }]))).toEqual([
      'basics',
      'attributes',
      'portrait',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'wealth',
      'actions',
      'features',
      'inventory',
      'spells',
      'notes',
    ]);
  });

  it('puts checks before actions and spells for a half-caster', () => {
    expect(orderedKeys(makeCharacter([{ name: 'Paladin', level: 6 }]))).toEqual([
      'basics',
      'attributes',
      'portrait',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'wealth',
      'actions',
      'spells',
      'features',
      'inventory',
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
      'wealth',
      'spells',
      'features',
      'inventory',
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
      'wealth',
      'actions',
      'features',
      'inventory',
      'spells',
      'notes',
    ]);
  });
});

const asSections = (keys: SectionKey[]): CharacterSection[] =>
  keys.map((key) => ({ key, title: key, count: 1, isEmpty: false }));

describe('applySavedOrder', () => {
  const base = asSections(['basics', 'skills', 'spells']);

  it('returns the base order when nothing is saved', () => {
    expect(applySavedOrder(base, []).map((s) => s.key)).toEqual([
      'basics',
      'skills',
      'spells',
    ]);
  });

  it('reorders to match a full saved order', () => {
    expect(
      applySavedOrder(base, ['spells', 'basics', 'skills']).map((s) => s.key),
    ).toEqual(['spells', 'basics', 'skills']);
  });

  it('appends unsaved keys after the saved ones in base order', () => {
    expect(applySavedOrder(base, ['spells']).map((s) => s.key)).toEqual([
      'spells',
      'basics',
      'skills',
    ]);
  });
});

describe('moveSectionByIndex', () => {
  const base = asSections(['basics', 'skills', 'spells', 'notes']);

  it('moves an item to a later index', () => {
    expect(moveSectionByIndex(base, 0, 2).map((s) => s.key)).toEqual([
      'skills',
      'spells',
      'basics',
      'notes',
    ]);
  });

  it('moves an item to an earlier index', () => {
    expect(moveSectionByIndex(base, 3, 1).map((s) => s.key)).toEqual([
      'basics',
      'notes',
      'skills',
      'spells',
    ]);
  });

  it('returns the same array for a no-op or out-of-range index', () => {
    expect(moveSectionByIndex(base, 1, 1)).toBe(base);
    expect(moveSectionByIndex(base, -1, 2)).toBe(base);
    expect(moveSectionByIndex(base, 0, 9)).toBe(base);
  });
});

describe('moveVisibleByIndex', () => {
  // Full order with 'skills' hidden — visible list is [basics, spells, notes].
  const base = asSections(['basics', 'skills', 'spells', 'notes']);
  const hidden: SectionKey[] = ['skills'];

  it('moves a visible card past the hidden section using visible indices', () => {
    // Drag visible[0] (basics) to visible[1] (spells): basics lands in spells'
    // full slot, jumping over the hidden 'skills'.
    expect(moveVisibleByIndex(base, hidden, 0, 1).map((s) => s.key)).toEqual([
      'skills',
      'spells',
      'basics',
      'notes',
    ]);
  });

  it('moves a visible card to the front', () => {
    // Drag visible[2] (notes) to visible[0] (basics).
    expect(moveVisibleByIndex(base, hidden, 2, 0).map((s) => s.key)).toEqual([
      'notes',
      'basics',
      'skills',
      'spells',
    ]);
  });

  it('returns the same array for a no-op or out-of-range visible index', () => {
    expect(moveVisibleByIndex(base, hidden, 1, 1)).toBe(base);
    expect(moveVisibleByIndex(base, hidden, 0, 5)).toBe(base);
  });
});
