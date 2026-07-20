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
    // Cleric 4 -> four d8 hit dice; no inspiration flag set.
    expect(basics.hitDice).toEqual([{ die: 8, count: 4 }]);
    expect(basics.inspiration).toBe(false);
    expect(basics.conditions).toEqual([]);
  });

  it('groups and orders multiclass hit dice by die size', () => {
    const character = {
      id: 1,
      name: 'Multiclass Hit Dice',
      classes: [
        { level: 2, definition: { name: 'Cleric', hitDice: 8 } },
        { level: 3, definition: { name: 'Fighter', hitDice: 10 } },
      ],
    } as unknown as RawCharacter;
    expect(normalizeCharacter(character).basics.hitDice).toEqual([
      { die: 10, count: 3 },
      { die: 8, count: 2 },
    ]);
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
    expect(defences).toContainEqual({ text: 'Magical Sleep Immunity' });
    // The restriction is the main label; the advantage is a leading qualifier.
    expect(defences).toContainEqual({
      text: 'Made to avoid or end the Charmed condition',
      qualifier: 'Advantage',
    });
    // A non-save advantage (item Stealth) is not counted as a defence.
    expect(defences.some((entry) => entry.text.toLowerCase().includes('stealth'))).toBe(
      false,
    );
    // Entries are ordered longest-first.
    const lengths = defences.map(
      (entry) => entry.text.length + (entry.qualifier?.length ?? 0),
    );
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
  });

  it('lists ability-specific saving throw advantages', () => {
    const character = {
      id: 1,
      name: 'Gnomish Cunning',
      stats: [],
      classes: [],
      modifiers: {
        race: [
          { type: 'advantage', subType: 'intelligence-saving-throws' },
          { type: 'advantage', subType: 'wisdom-saving-throws' },
          { type: 'advantage', subType: 'charisma-saving-throws' },
          { type: 'advantage', subType: 'stealth' },
        ],
      },
    } as unknown as RawCharacter;

    expect(normalizeCharacter(character).defences).toEqual(
      expect.arrayContaining([
        { text: 'advantage on Intelligence saves' },
        { text: 'advantage on Wisdom saves' },
        { text: 'advantage on Charisma saves' },
      ]),
    );
    expect(
      normalizeCharacter(character).defences.some((entry) => /stealth/i.test(entry.text)),
    ).toBe(false);
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

  it('applies dynamic feature bonuses and their explicit minimums to skills', () => {
    const character = {
      id: 1,
      name: 'Dynamic Skill Bonuses',
      stats: [
        { id: 4, name: null, value: 10 },
        { id: 5, name: null, value: 8 },
      ],
      classes: [],
      options: {
        class: [
          {
            componentId: 100,
            definition: {
              id: 200,
              name: 'Magician',
              description:
                '<p>You gain a bonus to your Intelligence (Arcana or Nature) checks equal to your Wisdom modifier (minimum bonus of +1).</p>',
            },
          },
        ],
      },
      modifiers: {
        class: [
          { type: 'bonus', subType: 'arcana', statId: 5, componentId: 200 },
          { type: 'bonus', subType: 'nature', statId: 5, componentId: 200 },
          { type: 'proficiency', subType: 'nature' },
          { type: 'bonus', subType: 'ability-checks', fixedValue: 1 },
          {
            type: 'bonus',
            subType: 'arcana',
            fixedValue: 10,
            restriction: 'Only while in a library',
          },
        ],
      },
    } as unknown as RawCharacter;

    const skills = new Map(
      normalizeCharacter(character).skills.map((skill) => [skill.key, skill.modifier]),
    );
    // INT +0, Magician's WIS -1 is floored to +1, plus broad +1.
    expect(skills.get('arcana')).toBe(2);
    // The same bonuses plus Nature proficiency (+2 at level 1).
    expect(skills.get('nature')).toBe(4);
    // Broad ability-check bonuses apply to every skill.
    expect(skills.get('athletics')).toBe(1);
  });

  it('lists actions including Channel Divinity', () => {
    const { actions } = normalizeCharacter(raw);
    const channelDivinity = actions.find((action) => action.name === 'Channel Divinity');
    expect(channelDivinity).toBeDefined();
    // Actions get a plain one-line summary with placeholders stripped.
    expect(channelDivinity?.summary).toContain('channel');
    expect(channelDivinity?.summary).not.toContain('{{');
    // Two uses; regains one on a short rest and all on a long rest — the reset
    // type only records the long rest, so the short-rest recovery is inferred.
    expect(channelDivinity?.resource).toEqual({
      max: 2,
      recovery: { kind: 'partial-short-full-long', shortRestUses: 1 },
    });
  });

  it('resolves save-DC and proficiency placeholders in summaries', () => {
    const { actions } = normalizeCharacter(raw);
    // {{savedc:wis}} -> 8 + proficiency(2) + WIS(+4) = 14.
    const divineSpark = actions.find(
      (action) => action.name === 'Channel Divinity: Divine Spark',
    );
    expect(divineSpark?.summary).toContain('DC 14');
    expect(divineSpark?.summary).not.toMatch(/DC\s+Con/);
    // {{13+proficiency}} -> 13 + 2 = 15, so no empty "(DC )".
    const voices = actions.find(
      (action) => action.name === 'Gathered Whispers: Voices from Beyond',
    );
    expect(voices?.summary).toContain('DC 15');
    expect(voices?.summary).not.toContain('(DC )');
    for (const action of actions) {
      expect(action.summary ?? '').not.toContain('{{');
    }
  });

  it('prefers character-bound feature snippets over static class templates', () => {
    const character = {
      id: 1,
      name: 'Scaled Rogue',
      classes: [
        {
          level: 7,
          definition: {
            name: 'Rogue',
            classFeatures: [
              {
                id: 100,
                name: 'Sneak Attack',
                requiredLevel: 1,
                description: '<p>Once per turn, deal an extra 1d6 damage.</p>',
              },
            ],
          },
          classFeatures: [
            {
              levelScale: null,
              definition: {
                id: 100,
                name: 'Sneak Attack',
                requiredLevel: 1,
                snippet: 'Once per turn, deal an extra {{(classlevel/2)@roundup}}d6 damage.',
                description: '<p>Once per turn, deal an extra 1d6 damage.</p>',
              },
            },
          ],
        },
      ],
    } as unknown as RawCharacter;

    const sneakAttack = normalizeCharacter(character)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Sneak Attack');
    expect(sneakAttack?.summary).toContain('4d6');
    expect(sneakAttack?.summary).not.toContain('1d6');
  });

  it('resolves action-local and character-level placeholder values', () => {
    const character = {
      id: 1,
      name: 'Dynamic Actions',
      stats: [{ id: 5, name: null, value: 16 }],
      race: { weightSpeeds: { normal: { walk: 30 } } },
      classes: [
        {
          level: 14,
          definition: {
            name: 'Fighter',
            classFeatures: [
              { id: 100, name: 'Second Wind', requiredLevel: 1 },
              { id: 101, name: 'Dreadful Strikes', requiredLevel: 3 },
            ],
          },
        },
      ],
      actions: {
        class: [
          {
            name: 'Second Wind',
            componentId: 100,
            snippet: 'Regain 1d10{{classlevel#signed}} HP; {{limiteduse}} uses.',
            limitedUse: { maxUses: 4, resetType: 1 },
          },
          {
            name: 'Dreadful Strikes',
            componentId: 101,
            snippet: 'Deal {{scalevalue}} Psychic damage.',
            dice: { diceCount: 1, diceValue: 4, diceString: '1d4' },
          },
          {
            name: 'Fleet Step',
            snippet: 'Move {{speed/2#rounddown}} feet.',
          },
          {
            name: 'Effect Roll',
            snippet: 'Roll the effect die.',
            dice: { diceCount: 1, diceValue: 6, diceString: '1d6' },
            abilityModifierStatId: 5,
          },
        ],
      },
      feats: [
        {
          definition: {
            id: 200,
            name: 'Tough',
            snippet: 'Your HP maximum increases by {{2*characterlevel}}.',
          },
        },
        {
          definition: {
            id: 201,
            name: 'Entity Test',
            snippet:
              'You gain &ldquo;clarity&rdquo; &amp; focus: &#65; &#x42; &#0; &#x110000;.',
          },
        },
        {
          definition: {
            id: 202,
            name: 'Ability Score Increases',
            snippet: 'Choose scores to increase.',
          },
        },
        {
          definition: {
            id: 203,
            name: 'Arithmetic Test',
            snippet:
              'Precedence {{2+3*4}}; grouped {{(2+3)*4}}; unary {{-2+5}}; invalid {{1/0}}.',
          },
        },
        {
          definition: {
            id: 204,
            name: 'Long Form',
            snippet: Array.from({ length: 120 }, () => 'word').join(' '),
          },
        },
      ],
    } as unknown as RawCharacter;

    const normalized = normalizeCharacter(character);
    const actionByName = new Map(normalized.actions.map((action) => [action.name, action]));
    expect(actionByName.get('Second Wind')?.summary).toBe('Regain 1d10+14 HP; 4 uses.');
    expect(actionByName.get('Dreadful Strikes')?.summary).toBe(
      'Deal 1d4 Psychic damage.',
    );
    expect(actionByName.get('Fleet Step')?.summary).toBe('Move 15 feet.');
    expect(actionByName.get('Effect Roll')?.roll).toBe('1d6+3');

    const feats = normalized.features.find((group) => group.label === 'Feats')?.items ?? [];
    expect(feats.find((item) => item.name === 'Tough')?.summary).toContain('28');
    expect(feats.find((item) => item.name === 'Entity Test')?.summary).toBe(
      'You gain "clarity" & focus: A B &#0; &#x110000;.',
    );
    expect(feats.find((item) => item.name === 'Arithmetic Test')?.summary).toBe(
      'Precedence 14; grouped 20; unary 3; invalid .',
    );
    expect(feats.find((item) => item.name === 'Long Form')?.summary).toMatch(/…$/);
    expect(feats.some((item) => !item.name)).toBe(false);
    expect(feats.some((item) => item.name === 'Ability Score Increases')).toBe(false);
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

  it('summarizes spellcasting: modifier, attack, save DC, and slots', () => {
    const { spellcasting } = normalizeCharacter(raw);
    // WIS 18 (+4), proficiency +2 at level 4.
    expect(spellcasting).toEqual({
      profiles: [
        { source: 'Cleric', ability: 'WIS', modifier: 4, attack: 6, saveDc: 14 },
      ],
      // A level-4 full caster has four 1st-level and three 2nd-level slots.
      slots: [4, 3],
    });
  });

  it('uses the class API slot row for rules-generation-specific progression', () => {
    const caster = (
      name: string,
      level: number,
      slots: number[][],
      options: {
        canCastSpells?: boolean;
        ability?: number;
        divisor?: number;
        rounding?: number;
      } = {},
    ) => ({
      id: level,
      name,
      stats: [{ id: options.ability ?? 5, name: null, value: 18 }],
      classes: [
        {
          level,
          definition: {
            name,
            canCastSpells: options.canCastSpells ?? true,
            spellCastingAbilityId: options.ability ?? 5,
            spellRules: {
              multiClassSpellSlotDivisor: options.divisor ?? 2,
              multiClassSpellSlotRounding: options.rounding ?? 2,
              levelSpellSlots: slots,
            },
          },
        },
      ],
    } as unknown as RawCharacter);

    const modernRows: number[][] = [];
    modernRows[1] = [2, 0, 0];
    modernRows[9] = [4, 3, 2];
    expect(normalizeCharacter(caster('Ranger', 9, modernRows)).spellcasting?.slots).toEqual([
      4, 3, 2,
    ]);

    const legacyRows: number[][] = [];
    legacyRows[1] = [0, 0, 0];
    expect(normalizeCharacter(caster('Ranger', 1, legacyRows)).spellcasting?.slots).toEqual([]);
  });

  it('models Pact Magic separately and supports subclass casters', () => {
    const pactRows = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [0, 2, 0],
      [0, 2, 0],
      [0, 0, 2],
    ];
    const warlock = {
      id: 1,
      name: 'Warlock',
      stats: [{ id: 6, name: null, value: 18 }],
      classes: [
        {
          level: 5,
          definition: {
            name: 'Occultist',
            canCastSpells: true,
            spellCastingAbilityId: 6,
            spellRules: {
              multiClassSpellSlotDivisor: 1,
              multiClassSpellSlotRounding: 1,
              levelSpellSlots: pactRows,
            },
          },
        },
      ],
    } as unknown as RawCharacter;
    expect(normalizeCharacter(warlock).spellcasting).toMatchObject({
      profiles: [
        { source: 'Occultist', ability: 'CHA', modifier: 4, attack: 7, saveDc: 15 },
      ],
      slots: [],
      pactSlots: [{ source: 'Occultist', level: 3, max: 2 }],
    });

    const standardRows: number[][] = [];
    standardRows[5] = [4, 3, 2];
    const mixed = structuredClone(warlock) as RawCharacter;
    mixed.name = 'Standard and Pact Caster';
    mixed.classes = [
      {
        level: 5,
        definition: {
          name: 'Standard Caster',
          canCastSpells: true,
          spellCastingAbilityId: 6,
          spellRules: {
            multiClassSpellSlotDivisor: 1,
            multiClassSpellSlotRounding: 1,
            levelSpellSlots: standardRows,
          },
        },
      },
      ...mixed.classes,
    ];
    expect(normalizeCharacter(mixed).spellcasting).toMatchObject({
      slots: [4, 3, 2],
      pactSlots: [{ source: 'Occultist', level: 3, max: 2 }],
    });

    const subclassRows: number[][] = [];
    subclassRows[7] = [4, 2, 0];
    const eldritchKnight = {
      id: 2,
      name: 'Subclass Caster',
      stats: [{ id: 4, name: null, value: 16 }],
      classes: [
        {
          level: 7,
          definition: {
            name: 'Martial Class',
            canCastSpells: false,
            spellRules: {
              multiClassSpellSlotDivisor: 3,
              multiClassSpellSlotRounding: 1,
              levelSpellSlots: subclassRows,
            },
          },
          subclassDefinition: {
            name: 'Arcane Student',
            canCastSpells: true,
            spellCastingAbilityId: 4,
          },
        },
      ],
    } as unknown as RawCharacter;
    expect(normalizeCharacter(eldritchKnight).spellcasting).toMatchObject({
      profiles: [
        {
          source: 'Martial Class (Arcane Student)',
          ability: 'INT',
          modifier: 3,
          attack: 6,
          saveDc: 14,
        },
      ],
      slots: [4, 2],
    });
  });

  it('combines multiclass caster levels using API divisor and rounding metadata', () => {
    const character = {
      id: 1,
      name: 'Multiclass Caster',
      stats: [{ id: 4, name: null, value: 16 }],
      classes: [
        {
          level: 3,
          definition: {
            name: 'Modern Half Caster',
            canCastSpells: true,
            spellCastingAbilityId: 4,
            spellRules: {
              multiClassSpellSlotDivisor: 2,
              multiClassSpellSlotRounding: 2,
              levelSpellSlots: [],
            },
          },
        },
        {
          level: 2,
          definition: {
            name: 'Full Caster',
            canCastSpells: true,
            spellCastingAbilityId: 4,
            spellRules: {
              multiClassSpellSlotDivisor: 1,
              multiClassSpellSlotRounding: 1,
              levelSpellSlots: [],
            },
          },
        },
        {
          level: 10,
          definition: {
            name: 'Unknown Homebrew Caster',
            canCastSpells: true,
            spellCastingAbilityId: 4,
          },
        },
      ],
    } as unknown as RawCharacter;

    // ceil(3/2) + 2 = effective caster level 4.
    // The metadata-free homebrew caster contributes no guessed slots.
    expect(normalizeCharacter(character).spellcasting?.slots).toEqual([4, 3]);
  });

  it('keeps different multiclass casting abilities and save DCs separate', () => {
    const rows: number[][] = [];
    rows[3] = [4, 2];
    const character = {
      id: 1,
      name: 'Two Casting Abilities',
      stats: [
        { id: 4, name: null, value: 18 },
        { id: 5, name: null, value: 14 },
      ],
      classes: [
        {
          level: 3,
          definition: {
            name: 'Wizard',
            canCastSpells: true,
            spellCastingAbilityId: 4,
            spellRules: { multiClassSpellSlotDivisor: 1, levelSpellSlots: rows },
            classFeatures: [{ id: 100, name: 'Arcane Power', requiredLevel: 1 }],
          },
        },
        {
          level: 3,
          definition: {
            name: 'Cleric',
            canCastSpells: true,
            spellCastingAbilityId: 5,
            spellRules: { multiClassSpellSlotDivisor: 1, levelSpellSlots: rows },
            classFeatures: [{ id: 200, name: 'Divine Power', requiredLevel: 1 }],
          },
        },
      ],
      actions: {
        class: [
          { name: 'Arcane Save', componentId: 100, saveStatId: 2 },
          { name: 'Divine Save', componentId: 200, saveStatId: 2 },
        ],
      },
      spells: {
        class: [
          { spellCastingAbilityId: 4, definition: { name: 'Fire Bolt', level: 0 } },
          { spellCastingAbilityId: 5, definition: { name: 'Sacred Flame', level: 0 } },
        ],
      },
    } as unknown as RawCharacter;

    const normalized = normalizeCharacter(character);
    expect(normalized.spellcasting?.profiles).toEqual([
      { source: 'Wizard', ability: 'INT', modifier: 4, attack: 7, saveDc: 15 },
      { source: 'Cleric', ability: 'WIS', modifier: 2, attack: 5, saveDc: 13 },
    ]);
    expect(normalized.spells.map((spell) => [spell.name, spell.ability])).toEqual([
      ['Fire Bolt', 'INT'],
      ['Sacred Flame', 'WIS'],
    ]);
    expect(normalized.actions.map((action) => [action.name, action.save])).toEqual([
      ['Arcane Save', 'DC 15 DEX'],
      ['Divine Save', 'DC 13 DEX'],
    ]);
  });

  it('resolves spell summaries using the granting class level', () => {
    const character = {
      id: 1,
      name: 'Multiclass Spell Grant',
      classes: [
        {
          level: 2,
          definition: { name: 'Martial Class', classFeatures: [] },
        },
        {
          level: 6,
          definition: {
            name: 'Magic Class',
            classFeatures: [{ id: 100, name: 'Magic Gift', requiredLevel: 1 }],
          },
        },
      ],
      spells: {
        class: [
          {
            componentId: 100,
            definition: {
              name: 'Class Gift',
              level: 1,
              snippet: 'The effect lasts {{classlevel}} rounds.',
            },
          },
        ],
      },
    } as unknown as RawCharacter;

    expect(normalizeCharacter(character).spells[0].summary).toBe(
      'The effect lasts 6 rounds.',
    );
  });

  it('enriches spells with school, casting time, range, components, and duration', () => {
    const dancingLights = normalizeCharacter(raw).spells.find(
      (spell) => spell.name === 'Dancing Lights',
    );
    expect(dancingLights).toMatchObject({
      level: 0,
      school: 'Illusion',
      castingTime: 'A',
      range: '120 ft.',
      components: 'V, S, M',
      concentration: true,
      duration: 'Conc, 1 minute',
    });
    // A blurb of several whole sentences — enough to play with, not just the
    // first line.
    expect(dancingLights?.summary).toContain('You create up to four torch-size lights within range');
    expect(dancingLights?.summary).toContain('Dim Light');
  });

  it('handles unknown casting times and area-only spell ranges', () => {
    const character = {
      id: 1,
      name: 'Odd Spell Shape',
      spells: {
        race: [
          {
            definition: {
              name: 'Burst',
              level: 1,
              activation: { activationType: 99, activationTime: 1 },
              range: { origin: '', aoeType: 1, aoeValue: 15 },
            },
          },
        ],
      },
    } as unknown as RawCharacter;
    expect(normalizeCharacter(character).spells[0]).toMatchObject({
      name: 'Burst',
      range: '15-ft.',
    });
    expect(normalizeCharacter(character).spells[0].castingTime).toBeUndefined();
  });

  it('structures a spell description with named options as a list', () => {
    const command = normalizeCharacter(raw).spells.find((spell) => spell.name === 'Command');
    const summary = command?.summary ?? '';
    expect(summary).toContain('Choose the command from these options');
    expect(summary).not.toContain('**');
    const labels = command?.list?.items.map((item) => item.label) ?? [];
    for (const heading of ['Approach', 'Drop', 'Flee', 'Grovel', 'Halt']) {
      expect(labels).toContain(heading);
    }
    expect(labels).toContain('Using a Higher-Level Spell Slot');
    expect(JSON.stringify(command?.list)).not.toContain('<');
  });

  it('drops an embedded rules table from a spell summary instead of flattening it', () => {
    const augury = normalizeCharacter(raw).spells.find((spell) => spell.name === 'Augury');
    const summary = augury?.summary ?? '';
    expect(summary).toContain('You receive an omen');
    // The Omens table's cells ("Weal | Good", "Woe | Bad", …) must not leak in as
    // run-on text.
    expect(summary).not.toContain('Weal');
    expect(summary).not.toContain('Neither good nor bad');
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
    const names = classFeatures?.items.map((item) => item.name) ?? [];
    expect(names).toContain('Spellcasting');
    // Structural placeholders (the ASI bump, the subclass choice, and the
    // "Core Cleric Traits" summary header) are dropped.
    expect(names).not.toContain('Ability Score Improvement');
    expect(names.some((name) => name.endsWith('Subclass'))).toBe(false);
    expect(names).not.toContain('Core Cleric Traits');
  });

  it('canonicalizes progression updates and omits dedicated-card plumbing', () => {
    const character = {
      id: 1,
      name: 'Progression Features',
      classes: [
        {
          level: 10,
          definition: {
            name: 'Fighter',
            classFeatures: [
              { id: 1, name: 'Hit Points', requiredLevel: 1, snippet: 'Hit Dice rules.' },
              { id: 2, name: 'Proficiencies', requiredLevel: 1, snippet: 'Training.' },
              {
                id: 3,
                name: 'Weapon Mastery',
                requiredLevel: 1,
                snippet: 'Use your selected mastery properties.',
              },
              {
                id: 4,
                name: '4: Weapon Mastery',
                requiredLevel: 4,
                snippet: 'Choose another mastery.',
              },
              {
                id: 5,
                name: '9: Expertise',
                requiredLevel: 9,
                snippet: 'Gain Expertise in another skill.',
              },
              {
                id: 6,
                name: '8: Ability Score Improvement',
                requiredLevel: 8,
                snippet: 'Choose a feat.',
              },
              {
                id: 7,
                name: 'Scaled Training',
                requiredLevel: 1,
                snippet: 'You know {{scalevalue}} techniques.',
                levelScales: [
                  { level: 1, fixedValue: 1 },
                  { level: 7, fixedValue: 4 },
                  { level: 15, fixedValue: 6 },
                ],
              },
            ],
          },
        },
      ],
    } as unknown as RawCharacter;

    const features = normalizeCharacter(character)
      .features.find((group) => group.label === 'Class Features')
      ?.items ?? [];
    expect(features.map((item) => item.name)).toEqual([
      'Weapon Mastery',
      'Expertise',
      'Scaled Training',
    ]);
    expect(features.find((item) => item.name === 'Scaled Training')?.summary).toBe(
      'You know 4 techniques.',
    );
  });

  it('gives features a plain-text summary with placeholders stripped', () => {
    const { features } = normalizeCharacter(raw);
    const items = features.flatMap((group) => group.items);
    // Some features carry a blurb, and none leak raw HTML or {{…}} placeholders.
    expect(items.some((item) => (item.summary?.length ?? 0) > 0)).toBe(true);
    for (const item of items) {
      expect(item.summary ?? '').not.toContain('{{');
      expect(item.summary ?? '').not.toContain('<');
      for (const part of item.parts ?? []) {
        expect(part.text).not.toContain('{{');
        expect(part.text).not.toContain('<');
      }
    }
    // Channel Divinity is itself an Actions-card ability, so it just points there.
    const channelDivinity = items.find((item) => item.name === 'Channel Divinity');
    expect(channelDivinity?.reference).toBe('actions');
    expect(channelDivinity?.summary).toBeUndefined();
  });

  it('only points a feature to a substantive action owned by that feature', () => {
    const character = {
      id: 1,
      name: 'Scoped Actions',
      classes: [
        {
          level: 1,
          definition: {
            name: 'Fighter',
            classFeatures: [
              {
                id: 100,
                name: 'Shared Power',
                requiredLevel: 1,
                snippet: 'This feature keeps its own important rules text.',
              },
              {
                id: 200,
                name: 'Other Feature',
                requiredLevel: 1,
                snippet: 'This other feature owns the action.',
              },
              {
                id: 300,
                name: 'Empty Power',
                requiredLevel: 1,
                snippet: 'This feature must not point to an empty action row.',
              },
            ],
          },
        },
      ],
      actions: {
        class: [
          {
            name: 'Shared Power',
            componentId: 200,
            activation: { activationType: 1 },
            snippet: 'Substantive detail from an unrelated component.',
          },
          {
            name: 'Empty Power',
            componentId: 300,
            activation: { activationType: 1 },
          },
        ],
      },
    } as unknown as RawCharacter;

    const items = normalizeCharacter(character).features.flatMap((group) => group.items);
    expect(items.find((item) => item.name === 'Shared Power')?.summary).toBe(
      'This feature keeps its own important rules text.',
    );
    expect(items.find((item) => item.name === 'Empty Power')?.summary).toBe(
      'This feature must not point to an empty action row.',
    );
  });

  it('drops sentences that reference a rules table (absent from the sheet)', () => {
    const items = normalizeCharacter(raw).features.flatMap((group) => group.items);
    // No blurb or sub-part still points at a table the printed sheet lacks …
    for (const item of items) {
      expect(item.summary ?? '').not.toMatch(/\btables?\b/i);
      for (const part of item.parts ?? []) expect(part.text).not.toMatch(/\btables?\b/i);
    }
    // A feature whose lone sentence pointed at a table keeps the sentence with
    // just the table pointer trimmed off, rather than losing all of its info.
    const domainSpells = items.find((item) => item.name === 'Grave Domain Spells');
    expect(domainSpells?.summary).toContain('always have the listed spells prepared');
    expect(domainSpells?.summary).not.toMatch(/\btable\b/i);
  });

  it('breaks a feature into named sub-parts, noting action sub-parts briefly', () => {
    const items = normalizeCharacter(raw).features.flatMap((group) => group.items);

    const circle = items.find((item) => item.name === 'Circle of Mortality');
    const circleLabels = circle?.parts?.map((part) => part.label) ?? [];
    expect(circleLabels).toContain('Pull of Death');
    expect(circleLabels).toContain('Return to Life');
    // Pull of Death is also an action, so the feature points to the Actions card.
    expect(circle?.parts?.find((part) => part.label === 'Pull of Death')?.reference).toBe(
      'actions',
    );
    // Return to Life isn't an action, so it keeps its text.
    expect(circle?.parts?.find((part) => part.label === 'Return to Life')?.text).toContain(
      'Spare the Dying',
    );
    // The un-named healing rider (all the info) is kept as a label-less part.
    expect(
      circle?.parts?.some((part) => part.label === '' && part.text.includes('restore 8')),
    ).toBe(true);

    // Channel Divinity is itself an Actions-card ability (its Divine Spark / Turn
    // Undead effects are actions), so the whole feature collapses to a pointer.
    const channel = items.find((item) => item.name === 'Channel Divinity');
    expect(channel?.reference).toBe('actions');
    expect(channel?.summary).toBeUndefined();
    expect(channel?.parts).toBeUndefined();

    const whispers = items.find((item) => item.name === 'Gathered Whispers');
    expect(whispers?.parts?.map((part) => part.label)).toEqual(
      expect.arrayContaining(['Spirit Whispers', 'Unearthly Scream', 'Voices from Beyond']),
    );
    // Spirit Whispers isn't an action -> full text (mentions Augury)…
    expect(whispers?.parts?.find((part) => part.label === 'Spirit Whispers')?.text).toContain(
      'Augury',
    );
    // …Unearthly Scream / Voices from Beyond are actions -> point to the Actions card.
    expect(
      whispers?.parts?.find((part) => part.label === 'Unearthly Scream')?.reference,
    ).toBe('actions');
    expect(
      whispers?.parts?.find((part) => part.label === 'Voices from Beyond')?.reference,
    ).toBe('actions');
  });

  it('preserves semantic benefit lists and varied HTML headings as feature parts', () => {
    const character = {
      id: 1,
      name: 'Structured Features',
      classes: [
        {
          level: 1,
          definition: {
            name: 'Fighter',
            classFeatures: [
              {
                id: 100,
                name: 'Adaptive Training',
                requiredLevel: 1,
                description:
                  '<p>You gain the following benefits.</p>' +
                  '<ul><li><strong>Guard.</strong> Gain 1 AC.</li>' +
                  '<li><em><strong>Rush.</strong></em> Move 10 feet.</li>' +
                  '<li>Gain proficiency with one tool.</li></ul>' +
                  '<p><strong><span>Legacy Technique.</span></strong> Use a d6.</p>' +
                  '<h5 class="Table-Styles_Table-Title">Benefits Known</h5>' +
                  '<div class="table-overflow-wrapper"><table><tbody>' +
                  '<tr><td>1</td><td>Guard</td></tr></tbody></table></div>' +
                  '<blockquote><p><strong>RULE TIP</strong></p>' +
                  '<p>This generic sidebar should not print.</p></blockquote>' +
                  '<h4>Greater Training</h4><p>You can use both benefits together.</p>' +
                  '<h4>First Empty Heading</h4><h4>Second Empty Heading</h4>',
              },
            ],
          },
        },
      ],
    } as unknown as RawCharacter;

    const feature = normalizeCharacter(character)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Adaptive Training');
    expect(feature?.summary).toBe('You gain the following benefits.');
    expect(feature?.parts).toEqual([
      { label: 'Guard', text: 'Gain 1 AC.' },
      { label: 'Rush', text: 'Move 10 feet.' },
      { label: '', text: '• Gain proficiency with one tool.' },
      { label: 'Legacy Technique', text: 'Use a d6.' },
      { label: 'Greater Training', text: 'You can use both benefits together.' },
      { label: 'First Empty Heading', text: '' },
      { label: 'Second Empty Heading', text: '' },
    ]);
    expect(feature?.parts?.some((part) => part.label === 'Benefits Known')).toBe(false);
    expect(feature?.parts?.some((part) => /sidebar|RULE TIP/.test(part.text))).toBe(false);
  });

  it('extracts companion stat blocks and rollable tables into dedicated sections', () => {
    const character = {
      id: 1,
      name: 'Artifacts',
      classes: [
        {
          level: 6,
          definition: {
            name: 'Artificer',
            classFeatures: [
              {
                id: 300,
                name: 'Steel Defender',
                requiredLevel: 3,
                description:
                  '<p>You create a loyal defender.</p>' +
                  '<div class="stat-block"><h5>Steel Defender</h5>' +
                  '<p>Medium Construct, Neutral</p>' +
                  '<p><strong>AC</strong> 15</p><p><strong>HP</strong> 35</p>' +
                  '<p><strong>Speed</strong> 40 ft.</p>' +
                  '<table><tbody><tr><th>STR</th><td>14</td><td>+2</td><td>+2</td></tr>' +
                  '<tr><th>DEX</th><td>12</td><td>+1</td><td>+1</td></tr></tbody></table>' +
                  '<p><strong>Immunities</strong> Poison; Charmed</p>' +
                  '<p class="monster-header">Actions</p>' +
                  '<p><strong><em>Rend.</em></strong> Melee Attack Roll.</p></div>' +
                  '<p>The defender acts immediately after you.</p>',
              },
              {
                id: 301,
                name: 'Dancing Item',
                requiredLevel: 6,
                description:
                  '<p>You animate an item.</p>' +
                  '<div class="Basic-Text-Frame stat-block-finder stat-block-background">' +
                  '<p class="Stat-Block-Styles_Stat-Block-Title">Dancing Item</p>' +
                  '<p class="Stat-Block-Styles_Stat-Block-Metadata">Large Construct</p>' +
                  '<p><strong>Armor Class</strong> 16</p><p><strong>Hit Points</strong> 40</p>' +
                  '<p><strong>Speed</strong> 30 ft.</p>' +
                  '<div class="stat-block-ability-scores-stat">' +
                  '<div class="stat-block-ability-scores-heading">STR</div>' +
                  '<div><span class="stat-block-ability-scores-score">18</span>' +
                  '<span class="stat-block-ability-scores-modifier">(+4)</span></div></div>' +
                  '<p class="Stat-Block-Styles_Stat-Block-Heading">Actions</p>' +
                  '<p><em><strong>Slam.</strong></em> Melee Weapon Attack.</p></div>' +
                  '<p>It remains animated for 1 hour.</p>',
              },
              {
                id: 302,
                name: 'Experimental Elixir',
                requiredLevel: 3,
                description:
                  '<p>Roll for the elixir effect.</p>' +
                  '<h4>Experimental Elixir</h4><table><thead><tr><th>d6</th><th>Effect</th></tr></thead>' +
                  '<tbody><tr><td><p>1</p></td><td><p><strong>Healing.</strong> Regain HP.</p></td></tr>' +
                  '<tr><td>2</td><td>Swiftness.</td></tr></tbody></table>' +
                  '<h4>Elixir Progression</h4><table><thead><tr><th>Level</th><th>Uses</th></tr></thead>' +
                  '<tbody><tr><td>3</td><td>1</td></tr></tbody></table>',
              },
            ],
          },
        },
      ],
    } as unknown as RawCharacter;

    const normalized = normalizeCharacter(character);
    expect(normalized.companions).toHaveLength(2);
    expect(normalized.companions[0]).toMatchObject({
      name: 'Steel Defender',
      armorClass: '15',
      hitPoints: '35',
      speed: '40 ft.',
      abilities: [
        { key: 'STR', score: '14', modifier: '+2', save: '+2' },
        { key: 'DEX', score: '12', modifier: '+1', save: '+1' },
      ],
    });
    expect(normalized.companions[0].details).toContainEqual({
      section: 'Actions',
      label: 'Rend',
      text: 'Melee Attack Roll.',
    });
    expect(normalized.companions[1]).toMatchObject({
      name: 'Dancing Item',
      abilities: [{ key: 'STR', score: '18', modifier: '(+4)' }],
    });
    expect(normalized.ruleTables).toEqual([
      {
        title: 'Experimental Elixir',
        source: 'Experimental Elixir',
        columns: ['d6', 'Effect'],
        rows: [
          ['1', 'Healing. Regain HP.'],
          ['2', 'Swiftness.'],
        ],
      },
    ]);

    const features = normalized.features.flatMap((group) => group.items);
    expect(features.find((item) => item.name === 'Steel Defender')?.related).toContain(
      'companions',
    );
    expect(features.find((item) => item.name === 'Experimental Elixir')?.related).toContain(
      'tables',
    );
    expect(features.find((item) => item.name === 'Dancing Item')?.summary).toContain(
      'remains animated for 1 hour',
    );
    expect(normalized.sections.find((section) => section.key === 'companions')).toMatchObject({
      count: 5,
      isEmpty: false,
    });
    expect(normalized.sections.find((section) => section.key === 'tables')).toMatchObject({
      count: 2,
      isEmpty: false,
    });
  });

  it('handles sparse stat blocks and caption or source-titled roll tables', () => {
    const character = {
      id: 1,
      name: 'Sparse Artifacts',
      feats: [
        {
          definition: {
            name: 'Spectral Companion',
            description:
              '<div class="stat-block"><h5>Spectral Pet</h5>' +
              '<table><tbody><tr><th>STR</th><td>10</td></tr></tbody></table>' +
              '<p><strong>Incorporeal Movement.</strong> It can move through creatures.</p></div>',
          },
        },
        {
          definition: {
            id: 400,
            name: 'Captioned Results',
            description:
              '<table><caption>Wild Outcomes</caption><thead><tr><th>Roll</th><th>Effect</th></tr></thead>' +
              '<tbody><tr><td>1</td><td>Glow.</td></tr></tbody></table>',
          },
        },
        {
          definition: {
            id: 401,
            name: 'Source Titled Results',
            description:
              '<table><thead><tr><th>d20</th><th>Effect</th></tr></thead>' +
              '<tbody><tr><td>1</td><td>Echo.</td></tr></tbody></table>',
          },
        },
      ],
    } as unknown as RawCharacter;

    const normalized = normalizeCharacter(character);
    expect(normalized.companions).toEqual([
      {
        name: 'Spectral Pet',
        source: 'Spectral Companion',
        abilities: [{ key: 'STR', score: '10' }],
        details: [
          {
            section: 'Details',
            label: 'Incorporeal Movement',
            text: 'It can move through creatures.',
          },
        ],
      },
    ]);
    expect(normalized.ruleTables.map((table) => table.title)).toEqual([
      'Wild Outcomes',
      'Source Titled Results',
    ]);
  });

  it('extracts companion stat blocks from active summoning spells', () => {
    const character = {
      id: 1,
      name: 'Summoner',
      classSpells: [
        {
          spells: [
            {
              prepared: true,
              definition: {
                name: 'Summon Beast',
                level: 2,
                description:
                  '<p>You call forth a bestial spirit.</p>' +
                  '<div class="stat-block"><h4>Bestial Spirit</h4>' +
                  '<p>Small Beast, Neutral</p>' +
                  '<p><strong>AC</strong> 11 + the spell’s level</p>' +
                  '<p><strong>HP</strong> 20 or 30 + 5 for each spell level above 2</p>' +
                  '<p><strong>Speed</strong> 30 ft.; Fly 60 ft. (Air only)</p>' +
                  '<table><tbody><tr><th>STR</th><td>18</td><td>+4</td><td>+4</td></tr>' +
                  '<tr><th>DEX</th><td>11</td><td>&minus;3</td><td>&minus;3</td></tr></tbody></table>' +
                  '<p><strong>Resistances</strong> Cold</p>' +
                  '<p><strong>Senses</strong> Darkvision 60 ft.; Passive Perception 12</p>' +
                  '<p class="monster-header">Actions</p>' +
                  '<p><strong><em>Rend.</em></strong> Melee Attack Roll.</p></div>',
              },
            },
            {
              prepared: true,
              definition: {
                name: 'Summon Fey',
                level: 3,
                description:
                  '<p>You call forth a fey spirit.</p>' +
                  '<div class="Basic-Text-Frame stat-block-finder stat-block-background">' +
                  '<p class="Stat-Block-Styles_Stat-Block-Title">Fey Spirit</p>' +
                  '<p class="Stat-Block-Styles_Stat-Block-Metadata">Small Fey, Neutral</p>' +
                  '<p><strong>Armor Class</strong> 12 + the spell’s level</p>' +
                  '<p><strong>Hit Points</strong> 30 + 10 for each spell level above 3</p>' +
                  '<div class="stat-block-ability-scores-stat">' +
                  '<div class="stat-block-ability-scores-heading">DEX</div>' +
                  '<div><span class="stat-block-ability-scores-score">16</span>' +
                  '<span class="stat-block-ability-scores-modifier">(+3)</span></div></div>' +
                  '<p class="Stat-Block-Styles_Stat-Block-Heading">Actions</p>' +
                  '<p><em><strong>Fey Blade.</strong></em> Melee Spell Attack.</p></div>' +
                  '<p>The spirit disappears when your concentration ends.</p>',
              },
            },
          ],
        },
      ],
    } as unknown as RawCharacter;

    const normalized = normalizeCharacter(character);
    expect(normalized.companions).toEqual([
      {
        name: 'Bestial Spirit',
        source: 'Summon Beast',
        meta: 'Small Beast, Neutral',
        armorClass: '11 + the spell’s level',
        hitPoints: '20 or 30 + 5 for each spell level above 2',
        speed: '30 ft.; Fly 60 ft. (Air only)',
        abilities: [
          { key: 'STR', score: '18', modifier: '+4', save: '+4' },
          { key: 'DEX', score: '11', modifier: '−3', save: '−3' },
        ],
        details: [
          { section: 'Statistics', label: 'Resistances', text: 'Cold' },
          {
            section: 'Statistics',
            label: 'Senses',
            text: 'Darkvision 60 ft.; Passive Perception 12',
          },
          { section: 'Actions', label: 'Rend', text: 'Melee Attack Roll.' },
        ],
      },
      {
        name: 'Fey Spirit',
        source: 'Summon Fey',
        meta: 'Small Fey, Neutral',
        armorClass: '12 + the spell’s level',
        hitPoints: '30 + 10 for each spell level above 3',
        abilities: [{ key: 'DEX', score: '16', modifier: '(+3)' }],
        details: [{ section: 'Actions', label: 'Fey Blade', text: 'Melee Spell Attack.' }],
      },
    ]);
    expect(normalized.sections.find((section) => section.key === 'companions')).toMatchObject({
      title: 'Companions',
      isEmpty: false,
    });
    expect(normalized.spells.find((spell) => spell.name === 'Summon Beast')).toMatchObject({
      summary: 'You call forth a bestial spirit.',
    });
    expect(normalized.spells.find((spell) => spell.name === 'Summon Beast')?.list).toBeUndefined();
    expect(normalized.spells.find((spell) => spell.name === 'Summon Fey')).toMatchObject({
      summary:
        'You call forth a fey spirit. The spirit disappears when your concentration ends.',
    });
    expect(normalized.spells.find((spell) => spell.name === 'Summon Fey')?.summary).not.toContain(
      'Fey Blade',
    );
  });

  it('structures alternate recovery costs and removes their duplicate prose', () => {
    const character = {
      id: 1,
      name: 'Alternate Recovery',
      actions: {
        class: [
          {
            name: 'Know Your Enemy',
            limitedUse: { maxUses: 1, resetType: 2 },
            snippet:
              'Learn a weakness. Once used, you regain the use after a Long Rest. ' +
              'You can also restore a use of the feature by expending one Superiority Die (no action required).',
          },
          {
            name: 'Psychic Veil',
            limitedUse: { maxUses: 1, resetType: 2 },
            snippet:
              'Become Invisible. Once used, you regain the use after a Long Rest unless you expend three Psionic Energy Dice (no action required) to restore your use of it.',
          },
          {
            name: 'Complete Renewal',
            limitedUse: { maxUses: 3, resetType: 2 },
            snippet: 'You can restore all uses by expending 1 Hit Die.',
          },
          {
            name: 'Measured Renewal',
            limitedUse: { maxUses: 4, resetType: 2 },
            snippet: 'You can restore 2 uses by spending 3 Focus Points.',
          },
          {
            name: 'Repeated Renewal',
            limitedUse: { maxUses: 1, resetType: 2 },
            snippet: 'Restore one use by spending one Focus Point.',
            description: '<p>Restore one use by spending one Focus Point.</p>',
          },
          {
            name: 'Unscheduled Pool',
            limitedUse: { maxUses: 2, resetType: 0 },
          },
        ],
      },
    } as unknown as RawCharacter;

    const actions = new Map(normalizeCharacter(character).actions.map((action) => [action.name, action]));
    expect(actions.get('Know Your Enemy')?.resource?.alternateRecovery).toEqual([
      { restores: 1, cost: '1 Superiority Die' },
    ]);
    expect(actions.get('Psychic Veil')?.resource?.alternateRecovery).toEqual([
      { restores: 1, cost: '3 Psionic Energy Dice' },
    ]);
    expect(actions.get('Complete Renewal')?.resource?.alternateRecovery).toEqual([
      { restores: 'all', cost: '1 Hit Die' },
    ]);
    expect(actions.get('Measured Renewal')?.resource?.alternateRecovery).toEqual([
      { restores: 2, cost: '3 Focus Points' },
    ]);
    expect(actions.get('Repeated Renewal')?.resource?.alternateRecovery).toEqual([
      { restores: 1, cost: '1 Focus Point' },
    ]);
    expect(actions.get('Unscheduled Pool')?.resource).toEqual({ max: 2 });
    expect(actions.get('Know Your Enemy')?.summary).toBe('Learn a weakness.');
    expect(actions.get('Psychic Veil')?.summary).toBe('Become Invisible.');
  });

  it('keeps only the intro blurb for the Spellcasting feature', () => {
    const spellcasting = normalizeCharacter(raw)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Spellcasting');
    // The generic casting mechanics (cantrips, slots, preparing spells, …) live
    // on the Spells card, so only the basic intro is kept — no sub-parts.
    expect(spellcasting?.parts).toBeUndefined();
    expect(spellcasting?.summary).toBe(
      'You have learned to cast spells through prayer and meditation. The information below ' +
        'details how you use those rules with Cleric spells, which appear on the Cleric spell list.',
    );
  });

  it('leaves a feature without sub-parts as a plain summary', () => {
    const feyAncestry = normalizeCharacter(raw)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Fey Ancestry');
    expect(feyAncestry?.parts).toBeUndefined();
    expect(feyAncestry?.summary?.length ?? 0).toBeGreaterThan(0);
  });

  it('summarizes ability-score features as just the bumps they grant', () => {
    const items = normalizeCharacter(raw).features.flatMap((group) => group.items);
    // The Ability Score Improvement feat took +1 Strength / +1 Wisdom — shown as
    // the bumps, not the generic "one score by 2 or two by 1" text.
    const asi = items.find((item) => item.name === 'Ability Score Improvement');
    expect(asi?.summary).toBe('+1 Strength, +1 Wisdom');
    expect(asi?.parts).toBeUndefined();
    // The background's ability-score increase took +2 Wisdom / +1 Constitution
    // (biggest bump first).
    const background = items.find((item) => item.name === 'Spirit Medium Ability Score Increase');
    expect(background?.summary).toBe('+2 Wisdom, +1 Constitution');
    expect(background?.parts).toBeUndefined();
  });

  it('notes the ability bump on any other feature that also grants one', () => {
    // A half-feat that grants a benefit AND a stat bump keeps its own text and
    // also notes the bump (matched by the feat definition id).
    const character = {
      ...raw,
      classes: [],
      race: null,
      feats: [
        {
          definition: {
            id: 700,
            name: 'Resilient',
            snippet: 'You gain proficiency in one saving throw of your choice.',
            description: '<p>You gain proficiency in one saving throw of your choice.</p>',
          },
        },
      ],
      modifiers: {
        feat: [{ type: 'bonus', subType: 'constitution-score', value: 1, componentId: 700 }],
      },
    } as unknown as RawCharacter;

    const resilient = normalizeCharacter(character)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Resilient');
    expect(resilient?.summary).toContain('saving throw');
    expect(resilient?.parts).toContainEqual({ label: '', text: '+1 Constitution' });
  });

  it('removes feat metadata and replaces ability options with the selected score', () => {
    const telekineticDescription =
      '<p><em>General Feat (Prerequisite: Level 4+)</em></p>' +
      '<p>You gain the following benefits.</p>' +
      '<p><em><strong>Ability Score Increase.</strong></em> Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20.</p>' +
      '<p><em><strong>Minor Telekinesis.</strong></em> You learn the Mage Hand spell.</p>' +
      '<p><em><strong>Telekinetic Shove.</strong></em> Shove a creature as a Bonus Action.</p>';
    const character = {
      id: 1,
      name: 'Selected Half Feat',
      stats: [],
      classes: [],
      feats: [
        {
          definition: {
            id: 700,
            name: 'Telekinetic',
            description: telekineticDescription,
          },
        },
      ],
      choices: {
        feat: [{ componentId: 700, optionValue: 9002, optionIds: [9001, 9002, 9003] }],
        choiceDefinitions: [
          {
            id: 'feat-ability',
            options: [
              { id: 9001, label: 'Intelligence' },
              { id: 9002, label: 'Wisdom' },
              { id: 9003, label: 'Charisma' },
            ],
          },
        ],
      },
    } as unknown as RawCharacter;

    const telekinetic = normalizeCharacter(character)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Telekinetic');
    expect(telekinetic?.summary).toBe('You gain the following benefits.');
    expect(telekinetic?.summary).not.toContain('General Feat');
    expect(telekinetic?.parts).toEqual([
      { label: 'Ability Score Increase', text: '+1 Wisdom' },
      { label: 'Minor Telekinesis', text: 'You learn the Mage Hand spell.' },
      { label: 'Telekinetic Shove', text: 'Shove a creature as a Bonus Action.' },
    ]);

    character.choices!.feat![0].optionValue = null;
    const unresolved = normalizeCharacter(character)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Telekinetic');
    expect(unresolved?.parts?.[0]).toEqual({
      label: 'Ability Score Increase',
      text: 'Not selected in D&D Beyond',
    });
  });

  it('keeps a feature part actionable when its options live in a matching lookup table', () => {
    const character = {
      id: 1,
      name: 'Crafter',
      stats: [],
      classes: [],
      feats: [
        {
          definition: {
            id: 800,
            name: 'Crafter',
            description:
              '<p><em>Origin Feat</em></p>' +
              '<p>You gain the following benefits.</p>' +
              '<p><em><strong>Tool Proficiency.</strong></em> Choose three Artisan’s Tools.</p>' +
              '<p><em><strong>Discount.</strong></em> You receive a 20 percent discount.</p>' +
              '<p><em><strong>Fast Crafting.</strong></em> When you finish a Long Rest, you can craft one piece of gear from the Fast Crafting table, provided you have the associated tool and proficiency. The item lasts until your next Long Rest.</p>' +
              '<table><caption>Fast Crafting</caption><thead><tr><th>Artisan’s Tools</th><th>Crafted Gear</th></tr></thead><tbody>' +
              '<tr><td>Carpenter’s Tools</td><td>Ladder, Torch</td></tr>' +
              '<tr><td>Smith’s Tools</td><td>Ball Bearings, Bucket, Caltrops</td></tr>' +
              '</tbody></table>',
          },
        },
      ],
      modifiers: {
        feat: [
          {
            type: 'proficiency',
            subType: 'calligraphers-supplies',
            friendlySubtypeName: "Calligrapher's Supplies",
            componentId: 800,
          },
          {
            type: 'proficiency',
            subType: 'cooks-utensils',
            friendlySubtypeName: "Cook's Utensils",
            componentId: 800,
          },
        ],
      },
    } as unknown as RawCharacter;

    const crafter = normalizeCharacter(character)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Crafter');
    expect(crafter?.summary).toBe('You gain the following benefits.');
    expect(crafter?.parts?.find((part) => part.label === 'Tool Proficiency')?.text).toBe(
      "Calligrapher's Supplies, Cook's Utensils",
    );
    const fastCrafting = crafter?.parts?.find((part) => part.label === 'Fast Crafting')?.text;
    expect(fastCrafting).toContain('When you finish a Long Rest, you can craft one piece of gear');
    expect(fastCrafting).toContain('The item lasts until your next Long Rest.');
    expect(fastCrafting).not.toMatch(/Fast Crafting table/i);
    expect(
      crafter?.parts?.find((part) => part.label === 'Fast Crafting')?.list,
    ).toEqual({
      label: 'Crafted Gear',
      items: [
        { label: 'Carpenter’s Tools', text: 'Ladder, Torch' },
        { label: 'Smith’s Tools', text: 'Ball Bearings, Bucket, Caltrops' },
      ],
    });
  });

  it('tracks the limited free-cast spells a feature grants', () => {
    const spells = normalizeCharacter(raw).spells;
    // Gathered Whispers grants a free Augury once per long rest.
    expect(spells.find((spell) => spell.name === 'Augury')?.featureUses).toEqual([
      {
        source: 'Gathered Whispers',
        pool: { max: 1, recovery: { kind: 'rest', rest: 'long' } },
      },
    ]);
    // The Elven lineage grants a free Faerie Fire once per long rest — its spell
    // is granted via a lineage sub-option, resolved back to the owning feature.
    expect(spells.find((spell) => spell.name === 'Faerie Fire')?.featureUses).toEqual([
      {
        source: 'Elven Lineage Spells',
        pool: { max: 1, recovery: { kind: 'rest', rest: 'long' } },
      },
    ]);
    // A normal prepared/known spell carries no free-cast tracker.
    expect(spells.some((spell) => spell.featureUses == null)).toBe(true);
  });

  it('deduplicates identical spell grants but preserves independent pools', () => {
    const definition = { name: 'Shared Spell', level: 1 };
    const limitedUse = { maxUses: 1, resetType: 2 };
    const character = {
      id: 1,
      name: 'Shared Grants',
      feats: [
        { definition: { id: 100, name: 'First Grant', snippet: 'Grant a spell.' } },
        { definition: { id: 101, name: 'Second Grant', snippet: 'Grant a spell.' } },
      ],
      spells: {
        feat: [
          { definition, componentId: 100, limitedUse },
          { definition, componentId: 100, limitedUse },
          { definition, componentId: 101, limitedUse: { maxUses: 2, resetType: 1 } },
        ],
      },
    } as unknown as RawCharacter;

    expect(normalizeCharacter(character).spells[0].featureUses).toEqual([
      {
        source: 'First Grant',
        pool: { max: 1, recovery: { kind: 'rest', rest: 'long' } },
      },
      {
        source: 'Second Grant',
        pool: { max: 2, recovery: { kind: 'rest', rest: 'short' } },
      },
    ]);
  });

  it('does not duplicate an action\'s limited-use checkboxes on its feature', () => {
    const { features, actions } = normalizeCharacter(raw);
    const classFeatures = features.find((group) => group.label === 'Class Features');
    const channelDivinity = classFeatures?.items.find(
      (item) => item.name === 'Channel Divinity',
    );
    // The Channel Divinity ACTION already shows the use tracker, so the feature
    // omits the duplicate checkboxes.
    expect(channelDivinity?.resource).toBeUndefined();
    expect(actions.find((action) => action.name === 'Channel Divinity')?.resource).toEqual({
      max: 2,
      recovery: { kind: 'partial-short-full-long', shortRestUses: 1 },
    });
    // A passive feature has no resource tracker either.
    const passive = classFeatures?.items.find((item) => item.name === 'Circle of Mortality');
    expect(passive?.resource).toBeUndefined();
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

  it('omits generated sections when no feature requires them', () => {
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
    // The count is the distinct features actually shown: deduped and minus
    // hidden traits, structural placeholders (ASI / the subclass choice /
    // "Core Cleric Traits"), above-level granted features (Divine Intervention),
    // disguise-feat placeholders (Dark Bargain, Runestones), and choice prompts
    // replaced by their selected option (Elven Lineage -> Drow Lineage), plus
    // generic ability-score prompts that produced no concrete modifiers.
    expect(counts.features).toBe(18);
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
    // Unarmed Strike is always available (1 + STR bludgeoning): +4, 3 bludgeoning.
    const unarmed = attacks.find((attack) => attack.name === 'Unarmed Strike');
    expect(unarmed?.toHit).toBe(4);
    expect(unarmed?.damage).toMatchObject({ dice: '', bonus: 3, type: 'Bludgeoning' });
  });

  it('applies magic weapon bonuses and specific weapon proficiency', () => {
    const character = {
      id: 1,
      name: 'Magic Weapon',
      stats: [{ id: 1, name: null, value: 16 }],
      classes: [{ level: 1, definition: { name: 'Fighter', hitDice: 10 } }],
      inventory: [
        {
          id: 1,
          equipped: true,
          definition: {
            name: 'Moon Blade',
            filterType: 'Weapon',
            damage: { diceCount: 1, diceValue: 8, diceString: '1d8' },
            damageType: 'Slashing',
            attackType: 1,
            categoryId: 2,
            range: 5,
            grantedModifiers: [
              { type: 'set', fixedValue: 99 },
              { type: 'bonus', fixedValue: 1 },
              { type: 'bonus', value: 2 },
            ],
          },
        },
      ],
      modifiers: {
        class: [
          {
            type: 'proficiency',
            subType: 'moon-blade',
            friendlySubtypeName: 'Moon Blade',
          },
        ],
      },
    } as unknown as RawCharacter;

    const attack = normalizeCharacter(character).attacks.find(
      (entry) => entry.name === 'Moon Blade',
    );
    expect(attack).toMatchObject({
      toHit: 8,
      damage: { dice: '1d8', bonus: 6, type: 'Slashing' },
    });
  });

  it('shows "other"-category abilities but drops orphaned options', () => {
    const actions = normalizeCharacter(raw).actions;
    const names = actions.map((action) => action.name);
    // Real action-economy options are kept…
    expect(names).toContain('Channel Divinity');
    // …no-action / passive riders now appear in the "Other" group…
    expect(names).toContain('Pull of Death');
    expect(names).toContain('Path to the Grave: End Curse');
    expect(actions.find((a) => a.name === 'Pull of Death')?.category).toBe('other');
    expect(actions.find((a) => a.name === 'Path to the Grave: End Curse')?.category).toBe(
      'other',
    );
    // …but orphaned options (a subclass path the character didn't choose) are not.
    expect(names.some((name) => name.startsWith('Circle Spell:'))).toBe(false);
    expect(names).not.toContain('Initiate a Circle Spell');
  });

  it('enriches actions with resources, damage, saves, and range', () => {
    const byName = new Map(normalizeCharacter(raw).actions.map((a) => [a.name, a]));
    // Channel Divinity is usable twice; one use returns on a short rest, all on a long rest.
    expect(byName.get('Channel Divinity')?.resource).toEqual({
      max: 2,
      recovery: { kind: 'partial-short-full-long', shortRestUses: 1 },
    });
    // Divine Spark rolls 1d8 + Wisdom (+4), forces a DC 14 Con save, range 30 ft.
    const spark = byName.get('Channel Divinity: Divine Spark');
    expect(spark?.damage).toMatchObject({ dice: '1d8', bonus: 4 });
    expect(spark?.save).toBe('DC 14 CON');
    expect(spark?.range).toBe('30 ft.');
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
    // items are left out. Unarmed Strike is always appended. Other options stay
    // in the Actions list.
    expect(attacks.map((attack) => attack.name)).toEqual(['Greataxe', 'Unarmed Strike']);
    expect(actions.map((action) => action.name)).toEqual(['Rage']);
  });

  it('de-duplicates identical attack rows for repeated weapons', () => {
    const scimitar = {
      equipped: true,
      definition: {
        name: 'Scimitar',
        filterType: 'Weapon',
        damage: { diceString: '1d6' },
        damageType: 'Slashing',
      },
    };
    const twinBlades = {
      id: 3,
      name: 'Twin',
      stats: [
        { id: 1, name: null, value: 16 },
        { id: 2, name: null, value: 14 },
        { id: 3, name: null, value: 14 },
        { id: 4, name: null, value: 10 },
        { id: 5, name: null, value: 11 },
        { id: 6, name: null, value: 8 },
      ],
      classes: [{ level: 5, definition: { name: 'Fighter' } }],
      // Two equipped copies of the same weapon.
      inventory: [scimitar, structuredClone(scimitar)],
    } as unknown as RawCharacter;

    const { attacks } = normalizeCharacter(twinBlades);
    // The identical Scimitars collapse to one row (plus the always-on Unarmed Strike).
    expect(attacks.map((attack) => attack.name)).toEqual(['Scimitar', 'Unarmed Strike']);
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

describe('normalizeCharacter — filtering spurious features and actions', () => {
  const featureNames = (label: string): string[] => {
    const group = normalizeCharacter(raw).features.find((g) => g.label === label);
    return group?.items.map((item) => item.name) ?? [];
  };

  it('hides granted class features above the character level', () => {
    // Divine Intervention is a level-10 cleric feature; Noct is level 4. It is
    // granted (hideInSheet false) but gated by requiredLevel.
    expect(featureNames('Class Features')).not.toContain('Divine Intervention');
  });

  it('drops actions granted by a feature the character does not have', () => {
    const { actions } = normalizeCharacter(raw);
    const names = actions.map((action) => action.name);
    // "Initiate a Circle Spell" is granted by an unselected subclass component
    // (componentId 12373777) that isn't any feature the character has.
    expect(names).not.toContain('Initiate a Circle Spell');
    // A real feat-granted action is kept (its grantor feat is present).
    expect(names).toContain('Gathered Whispers: Unearthly Scream');
    // A real class-feature action is kept.
    expect(names).toContain('Channel Divinity: Turn Undead');
  });

  it('replaces a choice-base racial trait with the selected option', () => {
    const names = featureNames('Racial Traits');
    // "Elven Lineage" is just the choice prompt; the selected "Drow Lineage" is
    // the real benefit and should take its place.
    expect(names).not.toContain('Elven Lineage');
    expect(names).toContain('Drow Lineage');
    const racial = normalizeCharacter(raw).features.find((g) => g.label === 'Racial Traits');
    const drow = racial?.items.find((item) => item.name === 'Drow Lineage');
    // Drow Lineage's only blurb points at the "Elven Lineages table"; the pointer
    // is trimmed off but the useful text ("Darkvision increases to 120 ft. …") stays.
    expect(drow).toBeDefined();
    expect(drow?.summary).toContain('Darkvision increases to 120 ft.');
    expect(drow?.summary).not.toMatch(/\btable\b/i);
  });

  it('replaces a choice-base class feature with the selected option', () => {
    const names = featureNames('Class Features');
    // Same rule applied consistently to class features: "Divine Order" is a
    // choose-one prompt whose selected role ("Protector") carries the benefit.
    expect(names).not.toContain('Divine Order');
    expect(names).toContain('Protector');
    const protector = normalizeCharacter(raw)
      .features.find((g) => g.label === 'Class Features')
      ?.items.find((item) => item.name === 'Protector');
    expect(protector?.summary).toContain('proficiency');
  });

  it('filters out __DISGUISE_FEAT placeholder feats', () => {
    const names = featureNames('Feats');
    expect(names).not.toContain('Dark Bargain');
    expect(names).not.toContain('Runestones');
    // A genuine feat is kept.
    expect(names).toContain('Gathered Whispers');
  });

  it('leaves a choice-base feature untouched when its option carries no rules text', () => {
    // A selected option with an empty snippet is a minor parameter (a
    // spellcasting ability, an ability-score bump), not a benefit, so the base
    // feature keeps its own name.
    const character = {
      ...raw,
      classes: [
        {
          level: 4,
          definition: {
            name: 'Cleric',
            classFeatures: [{ id: 5001, name: 'Weird Insight', requiredLevel: 1 }],
          },
        },
      ],
      race: null,
      feats: [],
      options: {
        class: [
          {
            componentId: 5001,
            componentTypeId: 12168134,
            definition: { id: 99, name: 'Wisdom', snippet: '', description: '<p>Wisdom.</p>' },
          },
        ],
      },
    } as unknown as RawCharacter;

    const group = normalizeCharacter(character).features.find(
      (g) => g.label === 'Class Features',
    );
    const names = group?.items.map((item) => item.name) ?? [];
    expect(names).toContain('Weird Insight');
    expect(names).not.toContain('Wisdom');
  });
});

