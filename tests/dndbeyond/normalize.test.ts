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

  it('lists defensive traits from modifiers', () => {
    const { defences } = normalizeCharacter(raw);
    expect(defences).toContain('Magical Sleep Immunity');
    expect(defences).toContain(
      'Advantage on saves (Made to avoid or end the Charmed condition)',
    );
    // A non-save advantage (item Stealth) is not counted as a defence.
    expect(defences.some((entry) => entry.toLowerCase().includes('stealth'))).toBe(false);
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

  it('resolves the portrait section and an uncropped avatar url', () => {
    const character = normalizeCharacter(raw);
    expect(character.avatarUrl).toBeDefined();
    // The full avatar is fit within bounds, never cropped to a square token.
    expect(character.avatarUrl).toContain('fit=bounds');
    expect(character.avatarUrl).not.toContain('fit=crop');
    const portrait = character.sections.find((section) => section.key === 'portrait');
    expect(portrait?.isEmpty).toBe(false);
  });

  it('produces all fourteen sections in a stable order', () => {
    const character = normalizeCharacter(raw);
    expect(character.sections.map((section) => section.key)).toEqual([
      'portrait',
      'basics',
      'attributes',
      'skills',
      'savingThrows',
      'senses',
      'proficiencies',
      'attacks',
      'actions',
      'spells',
      'inventory',
      'wealth',
      'features',
      'notes',
    ]);
  });

  it('resolves senses with passive scores and darkvision', () => {
    const { senses } = normalizeCharacter(raw);
    expect(senses).toContainEqual({ label: 'Darkvision', value: '120 ft.' });
    expect(senses.some((entry) => entry.label === 'Passive Perception')).toBe(true);
  });

  it('collects free-text notes but omits personal possessions', () => {
    const withNotes = {
      ...raw,
      notes: {
        allies: 'The Harpers',
        personalPossessions: 'Gaming Set (Chosen Proficiency)',
        otherHoldings: null,
        organizations: null,
        enemies: null,
        backstory: 'Raised in the Underdark.',
        otherNotes: null,
      },
    } as RawCharacter;
    const { notes } = normalizeCharacter(withNotes);
    expect(notes).toContainEqual({ label: 'Backstory', text: 'Raised in the Underdark.' });
    expect(notes).toContainEqual({ label: 'Allies', text: 'The Harpers' });
    expect(notes.some((note) => note.label === 'Personal Possessions')).toBe(false);
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

  it('categorizes actions by activation type', () => {
    const { actions } = normalizeCharacter(raw);
    const categoryOf = new Map(actions.map((action) => [action.name, action.category]));
    expect(categoryOf.get('Channel Divinity')).toBe('action');
    expect(categoryOf.get('Channel Divinity: Path to the Grave')).toBe('bonus');
    expect(categoryOf.get('Gathered Whispers: Unearthly Scream')).toBe('reaction');
  });

  it('resolves equipped weapons as attacks with to-hit and damage', () => {
    const { attacks } = normalizeCharacter(raw);
    const morningstar = attacks.find((attack) => attack.name === 'Morningstar');
    expect(morningstar).toBeDefined();
    // STR +2 plus martial-weapon proficiency (+2) -> +4 to hit; 1d8 + 2 Piercing.
    expect(morningstar?.toHit).toBe(4);
    expect(morningstar?.damage).toMatchObject({ dice: '1d8', bonus: 2, type: 'Piercing' });
    expect(morningstar?.range).toBe('5 ft.');
    // Unequipped backpack weapons (Dagger, Mace) are not surfaced as attacks.
    expect(attacks.some((attack) => attack.name === 'Dagger')).toBe(false);
  });

  it('drops passive/special riders from the actions list', () => {
    const names = normalizeCharacter(raw).actions.map((action) => action.name);
    // Real action-economy options are kept…
    expect(names).toContain('Channel Divinity');
    // …but no-action / special riders D&D Beyond doesn't list as actions are not.
    expect(names.some((name) => name.startsWith('Circle Spell:'))).toBe(false);
    expect(names).not.toContain('Path to the Grave: End Curse');
    expect(names).not.toContain('Pull of Death');
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

  it('leaves a non-parseable avatar url unchanged', () => {
    const character = normalizeCharacter({
      ...raw,
      decorations: { ...raw.decorations, avatarUrl: 'http://[bad' },
    } as RawCharacter);
    expect(character.avatarUrl).toBe('http://[bad');
  });

  it('drops conditions with an unknown id', () => {
    const character = normalizeCharacter({
      ...raw,
      conditions: [{ id: 999999 }],
    } as unknown as RawCharacter);
    expect(character.basics.conditions).toEqual([]);
  });

  it('surfaces displayAsAttack weapons as attacks, not actions', () => {
    const raider = {
      id: 2,
      name: 'Raider',
      stats: [
        { id: 1, name: null, value: 16 },
        { id: 2, name: null, value: 14 },
        { id: 3, name: null, value: 14 },
        { id: 4, name: null, value: 10 },
        { id: 5, name: null, value: 11 },
        { id: 6, name: null, value: 8 },
      ],
      classes: [{ level: 5, definition: { name: 'Barbarian' } }],
      inventory: [
        { displayAsAttack: true, definition: { name: 'Greataxe' } },
        { displayAsAttack: true, definition: {} }, // flagged but unnamed → skipped
        { displayAsAttack: false, definition: { name: 'Backpack' } }, // not an attack
      ],
      actions: { class: [{ name: 'Rage', activation: { activationType: 1 } }] },
    } as unknown as RawCharacter;

    const { attacks, actions } = normalizeCharacter(raider);
    // The named weapon becomes an attack (not an action); the unnamed + unflagged
    // items are left out. Other options stay in the Actions list.
    expect(attacks.map((attack) => attack.name)).toEqual(['Greataxe']);
    expect(actions.map((action) => action.name)).toEqual(['Rage']);
  });

  it('merges spells from non-class sources and de-duplicates by name', () => {
    const mystic = {
      id: 3,
      name: 'Mystic',
      stats: [
        { id: 1, name: null, value: 8 },
        { id: 2, name: null, value: 14 },
        { id: 3, name: null, value: 12 },
        { id: 4, name: null, value: 13 },
        { id: 5, name: null, value: 10 },
        { id: 6, name: null, value: 16 },
      ],
      classes: [{ level: 3, definition: { name: 'Sorcerer' } }],
      classSpells: [
        {
          spells: [
            { definition: { name: 'Fire Bolt', level: 0 } },
            { definition: { name: 'Shield', level: 1 } },
          ],
        },
      ],
      spells: {
        race: [{ definition: { name: 'Shield', level: 1 } }], // duplicate of a class spell
        feat: [{ definition: { name: 'Misty Step', level: 2 } }],
      },
    } as unknown as RawCharacter;

    const { spells } = normalizeCharacter(mystic);
    const names = spells.map((spell) => spell.name);
    expect(names).toContain('Fire Bolt');
    expect(names).toContain('Misty Step'); // pulled in from a feat source
    expect(names.filter((name) => name === 'Shield')).toHaveLength(1); // deduped across sources
    // Still sorted ascending by level.
    for (let i = 1; i < spells.length; i += 1) {
      expect(spells[i].level).toBeGreaterThanOrEqual(spells[i - 1].level);
    }
  });

  it('keeps the largest range for a repeated special sense and falls back to the subtype label', () => {
    const seer = {
      ...raw,
      modifiers: {
        race: [
          { type: 'set-base', subType: 'darkvision', value: 60, friendlySubtypeName: 'Darkvision' },
          // Larger range, supplied via `fixedValue` rather than `value`.
          { type: 'set-base', subType: 'darkvision', fixedValue: 120, friendlySubtypeName: 'Darkvision' },
          { type: 'set-base', subType: 'blindsight', value: 10 }, // no friendly name
        ],
      },
    } as unknown as RawCharacter;

    const { senses } = normalizeCharacter(seer);
    // The 120 ft. darkvision (from fixedValue) beats the 60 ft. one from the same subtype.
    expect(senses).toContainEqual({ label: 'Darkvision', value: '120 ft.' });
    expect(senses.some((sense) => sense.value === '60 ft.')).toBe(false);
    // A sense with no friendly name is labelled by its raw subtype.
    expect(senses.some((sense) => sense.label === 'blindsight')).toBe(true);
  });
});
