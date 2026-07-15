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
    const channelDivinity = actions.find((action) => action.name === 'Channel Divinity');
    expect(channelDivinity).toBeDefined();
    // Actions get a plain one-line summary with placeholders stripped.
    expect(channelDivinity?.summary).toContain('channel');
    expect(channelDivinity?.summary).not.toContain('{{');
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
      ability: 'WIS',
      modifier: 4,
      attack: 6,
      saveDc: 14,
      // A level-4 full caster has four 1st-level and three 2nd-level slots.
      slots: [4, 3],
    });
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
    const channelDivinity = items.find((item) => item.name === 'Channel Divinity');
    expect(channelDivinity?.summary).toContain('channel divine energy');
  });

  it('breaks a feature into named sub-parts, noting action sub-parts briefly', () => {
    const items = normalizeCharacter(raw).features.flatMap((group) => group.items);

    const circle = items.find((item) => item.name === 'Circle of Mortality');
    const circleLabels = circle?.parts?.map((part) => part.label) ?? [];
    expect(circleLabels).toContain('Pull of Death');
    expect(circleLabels).toContain('Return to Life');
    // Pull of Death is also an action, so the feature points to the Actions card.
    expect(circle?.parts?.find((part) => part.label === 'Pull of Death')?.text).toBe(
      '(see Actions)',
    );
    // Return to Life isn't an action, so it keeps its text.
    expect(circle?.parts?.find((part) => part.label === 'Return to Life')?.text).toContain(
      'Spare the Dying',
    );
    // The un-named healing rider (all the info) is kept as a label-less part.
    expect(
      circle?.parts?.some((part) => part.label === '' && part.text.includes('restore 8')),
    ).toBe(true);

    const whispers = items.find((item) => item.name === 'Gathered Whispers');
    expect(whispers?.parts?.map((part) => part.label)).toEqual(
      expect.arrayContaining(['Spirit Whispers', 'Unearthly Scream', 'Voices from Beyond']),
    );
    // Spirit Whispers isn't an action -> full text (mentions Augury)…
    expect(whispers?.parts?.find((part) => part.label === 'Spirit Whispers')?.text).toContain(
      'Augury',
    );
    // …Unearthly Scream / Voices from Beyond are actions -> point to the Actions card.
    expect(whispers?.parts?.find((part) => part.label === 'Unearthly Scream')?.text).toBe(
      '(see Actions)',
    );
    expect(whispers?.parts?.find((part) => part.label === 'Voices from Beyond')?.text).toBe(
      '(see Actions)',
    );
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

  it('tracks the limited free-cast spells a feature grants', () => {
    const items = normalizeCharacter(raw).features.flatMap((group) => group.items);
    // Gathered Whispers grants a free Augury once per long rest.
    const whispers = items.find((item) => item.name === 'Gathered Whispers');
    expect(whispers?.spellUses).toContainEqual({
      name: 'Augury',
      pool: { max: 1, recharge: 'LR' },
    });
    // The Elven lineage grants a free Faerie Fire once per long rest — its spell
    // is granted via a lineage sub-option, resolved back to the trait.
    const lineageSpells = items.find((item) => item.name === 'Elven Lineage Spells');
    expect(lineageSpells?.spellUses).toContainEqual({
      name: 'Faerie Fire',
      pool: { max: 1, recharge: 'LR' },
    });
    // A feature that grants no limited spells has none.
    expect(items.find((item) => item.name === 'Fey Ancestry')?.spellUses).toBeUndefined();
  });

  it('does not duplicate an action\'s limited-use checkboxes on its feature', () => {
    const { features, actions } = normalizeCharacter(raw);
    const classFeatures = features.find((group) => group.label === 'Class Features');
    const channelDivinity = classFeatures?.items.find(
      (item) => item.name === 'Channel Divinity',
    );
    // The Channel Divinity ACTION already shows the "2 / long rest" tracker, so
    // the feature omits the duplicate checkboxes.
    expect(channelDivinity?.resource).toBeUndefined();
    expect(actions.find((action) => action.name === 'Channel Divinity')?.resource).toEqual(
      { max: 2, recharge: 'LR' },
    );
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
    // The count is the distinct features actually shown: deduped and minus
    // hidden traits, structural placeholders (ASI / the subclass choice /
    // "Core Cleric Traits"), above-level granted features (Divine Intervention),
    // disguise-feat placeholders (Dark Bargain, Runestones), and choice prompts
    // replaced by their selected option (Elven Lineage -> Drow Lineage).
    expect(counts.features).toBe(19);
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
    // Channel Divinity is usable twice per long rest.
    expect(byName.get('Channel Divinity')?.resource).toEqual({ max: 2, recharge: 'LR' });
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
    expect(drow?.summary).toContain('Darkvision');
  });

  it('replaces a choice-base class feature with the selected option', () => {
    const names = featureNames('Class Features');
    // Same rule applied consistently to class features: "Divine Order" is a
    // choose-one prompt whose selected role ("Protector") carries the benefit.
    expect(names).not.toContain('Divine Order');
    expect(names).toContain('Protector');
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

