import { describe, expect, it } from 'vitest';
import type { RawCharacter } from '@/services/dndbeyond/api-types';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';

const base: RawCharacter = {
  id: 1,
  name: 'Numeric parity fixture',
  classes: [{ level: 20, definition: { name: 'Adventurer' } }],
  stats: [
    { id: 1, name: null, value: 10 },
    { id: 2, name: null, value: 14 },
    { id: 3, name: null, value: 14 },
    { id: 4, name: null, value: 16 },
    { id: 5, name: null, value: 18 },
    { id: 6, name: null, value: 12 },
  ],
  race: { weightSpeeds: { normal: { walk: 30 } } },
};

describe('numeric parity from modifier semantics', () => {
  it('ignores legacy racial ASIs on a 2024 species without losing background feat ASIs', () => {
    const character = normalizeCharacter({
      ...base,
      baseHitPoints: 20,
      stats: [8, 13, 14, 15, 12, 10].map((value, index) => ({ id: index + 1, name: null, value })),
      race: { ...base.race, isLegacy: false },
      modifiers: {
        race: ['strength', 'dexterity', 'constitution'].map((ability) => ({
          type: 'bonus', subType: `${ability}-score`, value: 1,
        })),
        feat: ['strength', 'constitution', 'charisma'].map((ability) => ({
          type: 'bonus', subType: `${ability}-score`, value: 1, isGranted: false,
        })),
      },
    });
    expect(character.abilities.map(({ score }) => score)).toEqual([9, 13, 15, 15, 12, 11]);
    expect(character.basics).toMatchObject({ armorClass: 11, initiative: 1, hitPoints: { max: 60 } });
    expect(character.skills.find(({ key }) => key === 'acrobatics')?.modifier).toBe(1);
    expect(character.savingThrows.find(({ key }) => key === 'dex')?.modifier).toBe(1);
  });

  it.each([true, undefined])('retains racial ASIs for legacy or unspecified species metadata: %s', (isLegacy) => {
    const character = normalizeCharacter({
      ...base, race: { isLegacy },
      modifiers: { race: [{ type: 'bonus', subType: 'dexterity-score', value: 2 }] },
    });
    expect(character.abilities.find(({ key }) => key === 'dex')?.score).toBe(16);
  });

  it('does not bake conditional ability bonuses or setters into permanent scores', () => {
    const { abilities } = normalizeCharacter({
      ...base,
      modifiers: { feat: [
        { type: 'bonus', subType: 'strength-score', value: 2, restriction: 'while transformed' },
        { type: 'set', subType: 'dexterity-score', value: 19, restriction: 'while transformed' },
      ] },
    });
    expect(abilities.find(({ key }) => key === 'str')?.score).toBe(10);
    expect(abilities.find(({ key }) => key === 'dex')?.score).toBe(14);
  });

  it('adds explicit proficiency-derived initiative without guessing for an unspecified bonus', () => {
    const { basics } = normalizeCharacter({
      ...base, modifiers: { feat: [
        { type: 'bonus', subType: 'initiative', value: null, bonusTypes: [1] },
        { type: 'bonus', subType: 'initiative', value: null },
        { type: 'bonus', subType: 'initiative', value: 1 },
      ] },
    });
    expect(basics.initiative).toBe(9);
  });

  it('adds ability-derived initiative while excluding conditional bonuses', () => {
    const { basics } = normalizeCharacter({
      ...base, modifiers: { class: [
        { type: 'bonus', subType: 'initiative', statId: 5 },
        { type: 'bonus', subType: 'initiative', value: 10, restriction: 'while transformed' },
      ] },
    });
    expect(basics.initiative).toBe(6);
  });

  it.each([[undefined, 40], [1, 40], [2, 40], [3, 30]])(
    'applies non-heavy-armor speed only with eligible equipment (%s)',
    (armorTypeId, speed) => {
      const { basics } = normalizeCharacter({
        ...base,
        inventory: armorTypeId ? [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId } }] : [],
        modifiers: { class: [{
          type: 'bonus', subType: 'speed', value: 10, restriction: 'while you aren’t wearing Heavy armor.',
        }] },
      });
      expect(basics.speed).toBe(speed);
    },
  );

  it.each([[false, 60], [true, 30]])('sums unarmored movement increments once and excludes shields (%s)', (shield, speed) => {
    const { basics } = normalizeCharacter({
      ...base,
      classes: [{ level: 20, definition: { name: 'Monk' }, classFeatures: [{
        definition: { id: 10, name: 'Unarmored Movement', requiredLevel: 2 },
        levelScale: { level: 18, fixedValue: 30 },
      }] }],
      inventory: shield ? [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId: 4 } }] : [],
      modifiers: { class: [10, 5, 5, 5, 5].map((value) => ({
        type: 'bonus', subType: 'unarmored-movement', value,
      })) },
    });
    expect(basics.speed).toBe(speed);
  });

  it('uses a granted unarmored movement scale when the payload has no movement modifiers', () => {
    const { basics } = normalizeCharacter({
      ...base,
      classes: [{ level: 10, definition: { name: 'Monk' }, classFeatures: [{
        definition: { id: 10, name: 'Unarmored Movement', requiredLevel: 2 },
        levelScale: { level: 10, fixedValue: 20 },
      }] }],
      modifiers: { race: [{ type: 'bonus', subType: 'speed-walking', value: 5 }] },
    });
    expect(basics.speed).toBe(55);
  });

  it('does not grant numeric bonuses from future-level class features', () => {
    const { basics } = normalizeCharacter({
      ...base,
      classes: [{ level: 1, definition: { classFeatures: [{
        id: 10, name: 'Fast Movement', requiredLevel: 5,
      }] } }],
      modifiers: { class: [{
        type: 'bonus', subType: 'speed', value: 10, componentId: 10, componentTypeId: 12168134,
      }] },
    });
    expect(basics.speed).toBe(30);
  });

  it('resolves movement-linked climb and swim speeds after walking bonuses', () => {
    const { basics } = normalizeCharacter({
      ...base,
      modifiers: { class: [
        { type: 'bonus', subType: 'speed', value: 10 },
        { type: 'set', subType: 'innate-speed-climbing', value: null },
        { type: 'set', subType: 'innate-speed-swimming', value: null },
      ] },
    });
    expect(basics.speed).toBe(40);
    expect(basics.specialSpeeds).toEqual([{ label: 'Swim', value: 40 }, { label: 'Climb', value: 40 }]);
  });

  it('honors custom movement overrides after calculated movement', () => {
    const { basics } = normalizeCharacter({
      ...base, customSpeeds: [{ movementId: 1, distance: 25 }, { movementId: 4, distance: 50 }],
      modifiers: { class: [{ type: 'bonus', subType: 'speed', value: 10 }] },
    });
    expect(basics.speed).toBe(25);
    expect(basics.specialSpeeds).toEqual([{ label: 'Fly', value: 50 }]);
  });

  it('adds dynamic aura save bonuses without folding concentration-only bonuses into all saves', () => {
    const { savingThrows } = normalizeCharacter({
      ...base, modifiers: { class: [
        { type: 'proficiency', subType: 'constitution-saving-throws' },
        { type: 'bonus', subType: 'saving-throws', statId: 6 },
        { type: 'bonus', subType: 'constitution-saving-throws', statId: 4, restriction: 'to maintain Concentration.' },
      ] },
    });
    expect(savingThrows.find(({ key }) => key === 'con')?.modifier).toBe(9);
    expect(savingThrows.find(({ key }) => key === 'wis')?.modifier).toBe(5);
  });

  it('uses general save proficiency without stacking specific proficiency', () => {
    const { savingThrows } = normalizeCharacter({
      ...base, modifiers: { class: [
        { type: 'proficiency', subType: 'saving-throws' },
        { type: 'proficiency', subType: 'constitution-saving-throws' },
      ] },
    });
    expect(savingThrows.find(({ key }) => key === 'wis')?.modifier).toBe(10);
    expect(savingThrows.find(({ key }) => key === 'con')?.modifier).toBe(8);
  });

  it('applies Jack of All Trades only to skills lacking full proficiency', () => {
    const { skills } = normalizeCharacter({
      ...base,
      classes: [{ level: 5, definition: { name: 'Bard' } }],
      modifiers: { class: [
        { type: 'half-proficiency', subType: 'ability-checks' },
        { type: 'proficiency', subType: 'athletics' },
        { type: 'expertise', subType: 'perception' },
      ] },
    });
    expect(skills.find(({ key }) => key === 'acrobatics')).toMatchObject({ modifier: 3, proficiency: 'half' });
    expect(skills.find(({ key }) => key === 'athletics')?.modifier).toBe(3);
    expect(skills.find(({ key }) => key === 'perception')?.modifier).toBe(10);
  });

  it('includes skill-specific, ability-check, and general bonuses using their real values', () => {
    const { skills } = normalizeCharacter({
      ...base, modifiers: { class: [
        { type: 'bonus', subType: 'arcana', statId: 5 },
        { type: 'bonus', subType: 'ability-checks', value: 1 },
        { type: 'bonus', subType: 'charisma-ability-checks', statId: 5 },
        { type: 'bonus', subType: 'persuasion', value: 2 },
        { type: 'bonus', subType: 'arcana', value: 10, restriction: 'about dragons' },
      ] },
    });
    expect(skills.find(({ key }) => key === 'arcana')?.modifier).toBe(8);
    expect(skills.find(({ key }) => key === 'persuasion')?.modifier).toBe(8);
  });

  it('does not stack conditional AC bonuses into the base armor class', () => {
    const { basics } = normalizeCharacter({
      ...base, modifiers: { item: [
        { type: 'bonus', subType: 'armor-class', value: 1 },
        { type: 'bonus', subType: 'armor-class', value: 5, restriction: 'while a ward is active' },
      ] },
    });
    expect(basics.armorClass).toBe(13);
  });

  it('honors an explicit armor class override', () => {
    const { basics } = normalizeCharacter({
      ...base, characterValues: [{ typeId: 1, value: '19' }],
    });
    expect(basics.armorClass).toBe(19);
  });

  it.each([[true, 15, 40], [false, 12, 30]])(
    'applies unarmored bonuses from a selected activation option, not its orphaned modifiers (%s)',
    (selected, armorClass, speed) => {
      const { basics, savingThrows } = normalizeCharacter({
        ...base,
        classes: [{ level: 20, definition: { classFeatures: [{ id: 10, name: 'Defensive stance' }] } }],
        options: { class: selected ? [{
          componentId: 10,
          definition: { id: 11, name: 'Invoke stance', description: 'While the stance is active, gain these benefits.' },
        }] : [] },
        modifiers: { class: [
          { type: 'bonus', subType: 'unarmored-armor-class', statId: 4, componentId: 11, componentTypeId: 258900837 },
          { type: 'bonus', subType: 'speed', value: 10, componentId: 11, componentTypeId: 258900837 },
          { type: 'bonus', subType: 'constitution-saving-throws', statId: 4, restriction: 'to maintain Concentration.' },
        ] },
      });
      expect(basics).toMatchObject({ armorClass, speed });
      expect(savingThrows.find(({ key }) => key === 'con')?.modifier).toBe(2);
    },
  );

  it('does not add an unarmored AC bonus to worn armor or a shield', () => {
    const modifiers = { class: [{ type: 'bonus', subType: 'unarmored-armor-class', statId: 4 }] };
    expect(normalizeCharacter({
      ...base, modifiers,
      inventory: [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId: 1, armorClass: 11 } }],
    }).basics.armorClass).toBe(13);
    expect(normalizeCharacter({
      ...base, modifiers,
      inventory: [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId: 4, armorClass: 2 } }],
    }).basics.armorClass).toBe(14);
  });

  it('distinguishes unarmored formulas that forbid shields from those that permit them', () => {
    const character: RawCharacter = {
      ...base,
      inventory: [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId: 4, armorClass: 2 } }],
      modifiers: { class: [{ type: 'set', subType: 'unarmored-armor-class', statId: 5, componentId: 10 }] },
      classes: [{ level: 20, definition: { classFeatures: [{
        id: 10, name: 'Unarmored Defense',
        description: 'While you aren’t wearing armor or wielding a Shield, your base Armor Class equals 10 plus your Dexterity and Wisdom modifiers.',
      }] } }],
    };
    expect(normalizeCharacter(character).basics.armorClass).toBe(14);
    expect(normalizeCharacter({
      ...character,
      classes: [{ level: 20, definition: { classFeatures: [{
        id: 10, name: 'Unarmored Defense',
        description: 'While not wearing armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers. You can use a Shield.',
      }] } }],
      modifiers: { class: [{ type: 'set', subType: 'unarmored-armor-class', statId: 3, componentId: 10 }] },
    }).basics.armorClass).toBe(16);
  });

  it('honors a speed armor restriction supplied by its feature rather than its modifier', () => {
    const { basics } = normalizeCharacter({
      ...base,
      classes: [{ level: 20, definition: { classFeatures: [{
        id: 10, name: 'Roving',
        description: 'Your Speed increases by 10 feet while you aren’t wearing Heavy armor.',
      }] } }],
      inventory: [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId: 3 } }],
      modifiers: { class: [{ type: 'bonus', subType: 'speed', value: 10, componentId: 10 }] },
    });
    expect(basics.speed).toBe(30);
  });

  it.each([[8, 1], [18, 4]])('honors the stated minimum for an ability-derived save aura (%s)', (charisma, bonus) => {
    const { savingThrows } = normalizeCharacter({
      ...base,
      stats: [{ id: 6, name: null, value: charisma }],
      classes: [{ level: 20, definition: { classFeatures: [{
        id: 10, name: 'Protective aura',
        description: 'You gain a bonus to saving throws equal to your Charisma modifier (minimum bonus of +1).',
      }] } }],
      modifiers: { class: [{ type: 'bonus', subType: 'saving-throws', statId: 6, componentId: 10 }] },
    });
    expect(savingThrows.find(({ key }) => key === 'str')?.modifier).toBe(bonus);
  });

  it('stops an aura bonus while its explicitly named disabling condition applies', () => {
    const { savingThrows } = normalizeCharacter({
      ...base,
      conditions: [{ id: 7 }],
      classes: [{ level: 20, definition: { classFeatures: [{
        id: 10, name: 'Protective aura',
        description: 'The aura is inactive while you have the Incapacitated condition. You gain a bonus to saving throws equal to your Charisma modifier.',
      }] } }],
      modifiers: { class: [{ type: 'bonus', subType: 'saving-throws', statId: 6, componentId: 10 }] },
    });
    expect(savingThrows.find(({ key }) => key === 'wis')?.modifier).toBe(4);
  });

  it('does not apply a selected stance after its rules explicitly end it for armor', () => {
    const { basics } = normalizeCharacter({
      ...base,
      classes: [{ level: 20, definition: { classFeatures: [{ id: 10, name: 'Defensive stance' }] } }],
      options: { class: [{
        componentId: 10,
        definition: { id: 11, description: 'The stance ends early if you have the Incapacitated condition, if you don armor or a Shield, or if you attack with two hands.' },
      }] },
      inventory: [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId: 4 } }],
      modifiers: { class: [{
        type: 'bonus', subType: 'speed', value: 10, componentId: 11, componentTypeId: 258900837,
      }] },
    });
    expect(basics.speed).toBe(30);
  });

  it.each([[undefined, 30], [1, 30], [2, undefined], [3, undefined]])(
    'resolves armor-restricted innate flight without treating it as an always-active bonus (%s)',
    (armorTypeId, flight) => {
      const { basics } = normalizeCharacter({
        ...base,
        inventory: armorTypeId ? [{ id: 1, equipped: true, definition: { filterType: 'Armor', armorTypeId } }] : [],
        modifiers: { race: [{
          type: 'set', subType: 'innate-speed-flying', value: 30,
          restriction: 'Cannot be used if wearing medium or heavy armor.',
        }] },
      });
      expect(basics.specialSpeeds?.find(({ label }) => label === 'Fly')?.value).toBe(flight);
    },
  );

  it('retains a flight speed when its restriction field only describes hovering', () => {
    const { basics } = normalizeCharacter({
      ...base,
      modifiers: { class: [{ type: 'set', subType: 'speed-flying', value: 60, restriction: 'You can also hover.' }] },
    });
    expect(basics.specialSpeeds).toEqual([{ label: 'Fly', value: 60 }]);
  });

  it('does not use an unrelated resource minimum to clamp a dynamic initiative bonus', () => {
    const { basics } = normalizeCharacter({
      ...base,
      stats: [{ id: 2, name: null, value: 14 }, { id: 5, name: null, value: 8 }],
      classes: [{ level: 20, definition: { classFeatures: [{
        id: 10, name: 'Ambush',
        description: 'You can use a strike a number of times equal to your Wisdom modifier (minimum of 1). When you roll Initiative, you can add your Wisdom modifier to the roll.',
      }] } }],
      modifiers: { class: [{ type: 'bonus', subType: 'initiative', statId: 5, componentId: 10 }] },
    });
    expect(basics.initiative).toBe(1);
  });
});
