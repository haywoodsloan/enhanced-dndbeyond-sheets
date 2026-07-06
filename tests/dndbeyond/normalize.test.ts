import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { RawCharacter } from '@/services/dndbeyond/api-types';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';

// Load the fixture from disk (not a JSON import) to keep type-checking fast and
// avoid inferring a giant literal type from the ~550 KB file. Vitest runs with
// the project root as the working directory.
const raw = JSON.parse(
  readFileSync('tests/fixtures/noct.json', 'utf-8'),
) as RawCharacter;

describe('normalizeCharacter', () => {
  it('extracts core identity', () => {
    const character = normalizeCharacter(raw);
    expect(character.id).toBe(166869100);
    expect(character.name).toBe('Noct');
    expect(character.race).toBe('Elf');
    expect(character.background).toBe('Spirit Medium');
  });

  it('summarizes classes and total level', () => {
    const character = normalizeCharacter(raw);
    expect(character.classes).toEqual([
      { name: 'Cleric', level: 4, subclass: 'Grave Domain' },
    ]);
    expect(character.level).toBe(4);
  });

  it('resolves ability scores with granted bonuses', () => {
    const character = normalizeCharacter(raw);
    expect(character.abilities.map((ability) => ability.key)).toEqual([
      'str',
      'dex',
      'con',
      'int',
      'wis',
      'cha',
    ]);
    const byKey = Object.fromEntries(
      character.abilities.map((ability) => [ability.key, ability]),
    );
    // Base 14/10/13/12/15/8 plus feat bonuses STR+1, CON+1, WIS+3.
    expect(byKey.str).toMatchObject({ score: 15, modifier: 2 });
    expect(byKey.dex).toMatchObject({ score: 10, modifier: 0 });
    expect(byKey.con).toMatchObject({ score: 14, modifier: 2 });
    expect(byKey.int).toMatchObject({ score: 12, modifier: 1 });
    expect(byKey.wis).toMatchObject({ score: 18, modifier: 4 });
    expect(byKey.cha).toMatchObject({ score: 8, modifier: -1 });
  });

  it('computes the basics block', () => {
    const { basics } = normalizeCharacter(raw);
    // Plate (18, heavy) + shield (+2); heavy armor ignores Dex.
    expect(basics.armorClass).toBe(20);
    // Base 23 + Con(+2) x 4 = 31 max; 27 removed -> 4 current.
    expect(basics.hitPoints).toEqual({ current: 4, max: 31, temp: 0 });
    expect(basics.initiative).toBe(0);
    expect(basics.speed).toBe(30);
    expect(basics.proficiencyBonus).toBe(2);
    expect(basics.conditions).toEqual([]);
  });

  it('computes saving throws with proficiency', () => {
    const character = normalizeCharacter(raw);
    const byKey = Object.fromEntries(
      character.savingThrows.map((save) => [save.key, save]),
    );
    // Cleric is proficient in Wisdom and Charisma saves (+prof 2).
    expect(byKey.wis).toMatchObject({ modifier: 6, proficient: true });
    expect(byKey.cha).toMatchObject({ modifier: 1, proficient: true });
    expect(byKey.str).toMatchObject({ modifier: 2, proficient: false });
    expect(byKey.dex).toMatchObject({ modifier: 0, proficient: false });
    expect(byKey.con).toMatchObject({ modifier: 2, proficient: false });
    expect(byKey.int).toMatchObject({ modifier: 1, proficient: false });
  });

  it('computes 18 skills consistent with abilities and proficiency', () => {
    const character = normalizeCharacter(raw);
    expect(character.skills).toHaveLength(18);
    const abilityMod = Object.fromEntries(
      character.abilities.map((ability) => [ability.key, ability.modifier]),
    );
    const multiplier = { none: 0, half: 0.5, proficient: 1, expertise: 2 };
    for (const skill of character.skills) {
      const expected =
        abilityMod[skill.ability] + Math.floor(2 * multiplier[skill.proficiency]);
      expect(skill.modifier).toBe(expected);
    }
  });

  it('groups languages and training proficiencies', () => {
    const { proficiencies } = normalizeCharacter(raw);
    expect(proficiencies.languages).toEqual(
      expect.arrayContaining(['Common', 'Elvish', 'Goblin']),
    );
    expect(proficiencies.weapons.length).toBeGreaterThan(0);
    expect(proficiencies.armor.length).toBeGreaterThan(0);
  });

  it('lists actions including Channel Divinity', () => {
    const { actions } = normalizeCharacter(raw);
    expect(actions.some((action) => action.name === 'Channel Divinity')).toBe(true);
  });

  it('lists spells with levels, sorted ascending', () => {
    const { spells } = normalizeCharacter(raw);
    expect(spells.length).toBeGreaterThan(0);
    expect(spells.some((spell) => spell.name === 'Guidance' && spell.level === 0)).toBe(
      true,
    );
    for (let i = 1; i < spells.length; i += 1) {
      expect(spells[i].level).toBeGreaterThanOrEqual(spells[i - 1].level);
    }
  });

  it('lists inventory items and coins', () => {
    const character = normalizeCharacter(raw);
    expect(
      character.inventory.some((item) => item.name === 'Cloak of Elvenkind'),
    ).toBe(true);
    expect(character.wealth.gp).toBe(224);
  });

  it('groups features by source', () => {
    const { features } = normalizeCharacter(raw);
    expect(features.map((group) => group.label)).toContain('Class Features');
    const classFeatures = features.find((group) => group.label === 'Class Features');
    expect(classFeatures?.items).toContain('Spellcasting');
  });

  it('produces all ten sections in a stable order', () => {
    const character = normalizeCharacter(raw);
    expect(character.sections.map((section) => section.key)).toEqual([
      'basics',
      'attributes',
      'skills',
      'savingThrows',
      'proficiencies',
      'actions',
      'spells',
      'inventory',
      'wealth',
      'features',
    ]);
  });

  it('counts section contents', () => {
    const character = normalizeCharacter(raw);
    const counts = Object.fromEntries(
      character.sections.map((section) => [section.key, section.count]),
    );
    expect(counts.attributes).toBe(6);
    expect(counts.skills).toBe(18);
    expect(counts.savingThrows).toBe(6);
    expect(counts.spells).toBe(18);
    expect(counts.inventory).toBe(24);
    expect(counts.features).toBe(39);
    expect(counts.basics).toBe(0); // Noct has no active conditions
    expect(counts.proficiencies).toBeGreaterThan(0);
    expect(counts.actions).toBeGreaterThan(0);
  });

  it('never flags an empty section that still has entries', () => {
    const character = normalizeCharacter(raw);
    for (const section of character.sections) {
      if (section.isEmpty) expect(section.count).toBe(0);
    }
  });

  it('always shows the core stat sections', () => {
    const character = normalizeCharacter(raw);
    for (const key of ['basics', 'attributes', 'skills', 'savingThrows']) {
      const section = character.sections.find((entry) => entry.key === key);
      expect(section?.isEmpty).toBe(false);
    }
  });

  it('reports zero spells for a non-caster and marks the section empty', () => {
    const fighter = {
      id: 1,
      name: 'Grib',
      stats: [
        { id: 1, name: null, value: 16 },
        { id: 2, name: null, value: 12 },
        { id: 3, name: null, value: 14 },
        { id: 4, name: null, value: 10 },
        { id: 5, name: null, value: 11 },
        { id: 6, name: null, value: 8 },
      ],
      classes: [{ level: 3, definition: { name: 'Fighter' } }],
    } as unknown as RawCharacter;

    const spells = normalizeCharacter(fighter).sections.find(
      (section) => section.key === 'spells',
    );
    expect(spells?.count).toBe(0);
    expect(spells?.isEmpty).toBe(true);
  });
});
