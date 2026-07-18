import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { RawCharacter } from '@/services/dndbeyond/api-types';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';

// A second real D&D Beyond payload — Hest, a level 6 Tiefling Draconic Sorcerer
// (https://www.dndbeyond.com/characters/164534479). It exercises a different
// class, race, and background from the Noct cleric fixture: an arcane Charisma
// caster, Tiefling legacy traits, and a Charlatan origin — a useful reference
// and a regression guard for normalization beyond the primary fixture.
const raw = JSON.parse(readFileSync('tests/fixtures/hest.json', 'utf-8')) as RawCharacter;

describe('normalizeCharacter — Hest (level 6 draconic sorcerer)', () => {
  it('extracts core identity, class, race, and background', () => {
    const character = normalizeCharacter(raw);
    expect(character.id).toBe(164534479);
    expect(character.name).toBe('Hest');
    expect(character.race).toBe('Tiefling');
    expect(character.background).toBe('Charlatan');
    expect(character.level).toBe(6);
    expect(character.classes).toEqual([
      { name: 'Sorcerer', level: 6, subclass: 'Draconic Sorcery' },
    ]);
  });

  it('produces all fourteen sections in the stable order', () => {
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

  it('resolves the Charisma-focused ability spread', () => {
    const { abilities } = normalizeCharacter(raw);
    const scoreByKey = Object.fromEntries(abilities.map((ability) => [ability.key, ability.score]));
    expect(scoreByKey).toEqual({ str: 9, dex: 14, con: 12, int: 14, wis: 10, cha: 18 });
  });

  it('summarizes Charisma-based spellcasting with level-6 slots', () => {
    const { spellcasting } = normalizeCharacter(raw);
    expect(spellcasting).toEqual({
      ability: 'CHA',
      modifier: 4,
      attack: 7,
      saveDc: 15,
      slots: [4, 3, 3],
    });
  });

  it('groups the sorcerer, tiefling, and feat features', () => {
    const { features } = normalizeCharacter(raw);
    const itemsOf = (label: string) =>
      features.find((group) => group.label === label)?.items ?? [];
    const namesOf = (label: string) => itemsOf(label).map((item) => item.name);

    expect(namesOf('Class Features')).toEqual(
      expect.arrayContaining(['Font of Magic', 'Metamagic', 'Sorcerous Restoration']),
    );
    expect(namesOf('Racial Traits')).toContain('Infernal Legacy');
    // Infernal Legacy keeps its info even though its lone sentence pointed at a
    // "Fiendish Legacies table" — the pointer is trimmed, not the whole sentence.
    const infernal = itemsOf('Racial Traits').find(
      (item) => item.name === 'Infernal Legacy',
    );
    expect(infernal?.summary).toContain('resistance to Fire');
    expect(infernal?.summary).not.toMatch(/\btable\b/i);
    // The base feature is shown; its option-form duplicate is not listed too.
    expect(namesOf('Class Features')).toContain('Innate Sorcery');
    expect(namesOf('Class Features')).not.toContain('Activate Innate Sorcery');

    // The Ability Score Improvement feat shows just the bumps it granted…
    const asi = itemsOf('Feats').find((item) => item.name === 'Ability Score Improvement');
    expect(asi?.summary).toBe('+1 Dexterity, +1 Charisma');
    // …as does a plural "… Ability Score Improvements" origin increase.
    const charlatan = itemsOf('Feats').find(
      (item) => item.name === 'Charlatan Ability Score Improvements',
    );
    expect(charlatan?.summary).toBe('+2 Charisma, +1 Dexterity');
    expect(charlatan?.parts).toBeUndefined();
  });

  it('resolves dynamic-value placeholders in feature text', () => {
    const items = normalizeCharacter(raw).features.flatMap((group) => group.items);
    const summaryOf = (name: string) => items.find((item) => item.name === name)?.summary ?? '';
    // {{classlevel}} -> 6, {{modifier:cha}} -> +4, {{modifier:cha@min:1#unsigned}} -> 4.
    expect(summaryOf('Draconic Resilience')).toContain('increases by 6');
    expect(summaryOf('Elemental Affinity (Fire)')).toContain('add +4 to one damage roll');
    expect(summaryOf('Empowered Spell')).toContain('reroll up to 4 damage dice');
    // No unresolved placeholder braces remain in any feature text.
    expect(items.every((item) => !(item.summary ?? '').includes('{{'))).toBe(true);
  });

  it('strips table references and the repeatable-feat boilerplate', () => {
    const items = normalizeCharacter(raw).features.flatMap((group) => group.items);
    const find = (name: string) => items.find((item) => item.name === name);
    // Font of Magic loses its "Sorcerer Features table" sentences, keeps the rest.
    const fom = find('Font of Magic');
    expect(fom?.summary).not.toMatch(/\btable\b/i);
    expect(fom?.summary).toContain('Sorcery Points');
    // The "Repeatable — you can take this feat more than once" note is dropped
    // (and the table stripper's \btable\b boundary never touched "Repeatable").
    const skilled = find('Skilled');
    expect(
      (skilled?.parts ?? []).some((part) =>
        /repeatable|more than once/i.test(`${part.label ?? ''} ${part.text}`),
      ),
    ).toBe(false);
  });

  it('shows a skill feat\'s selected proficiencies instead of the generic text', () => {
    const items = normalizeCharacter(raw).features.flatMap((group) => group.items);
    const skilled = items.find((item) => item.name === 'Skilled');
    // The generic "any combination of your choice" blurb is replaced by the picks.
    expect(skilled?.summary).toBe('Stealth, Perception, Insight');
    expect(skilled?.summary).not.toMatch(/of your choice/i);
    // The repeatable-feat boilerplate note is dropped.
    expect((skilled?.parts ?? []).some((part) => part.label === 'Repeatable')).toBe(
      false,
    );
    // A pure ASI feat is unaffected — it still shows its bumps.
    const asi = items.find((item) => item.name === 'Ability Score Improvement');
    expect(asi?.summary).toBe('+1 Dexterity, +1 Charisma');
  });

  it('points Font of Magic option sub-parts to the Actions card', () => {
    const fom = normalizeCharacter(raw)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Font of Magic');
    const partText = (label: string) => fom?.parts?.find((part) => part.label === label)?.text;
    // These options are fully defined as actions ("Convert Spell Slots" / "Create
    // Spell Slot Level N"), so the feature just points there despite the wording
    // difference ("Creating Spell Slots" vs "Create Spell Slot Level 1").
    expect(partText('Converting Spell Slots to Sorcery Points')).toBe('(see Actions)');
    expect(partText('Creating Spell Slots')).toBe('(see Actions)');
    // The trailing rules rider (not an action) keeps its text.
    expect(fom?.parts?.find((part) => part.label === '')?.text).toContain('vanishes');
  });

  it('points the Innate Sorcery feature to its Bonus Action, which shows the full effect', () => {
    const character = normalizeCharacter(raw);
    const featureNamed = (name: string) =>
      character.features.flatMap((group) => group.items).find((item) => item.name === name);

    // The feature IS a Bonus Action detailed on the Actions card, so it just
    // references it rather than repeating the text.
    const feature = featureNamed('Innate Sorcery');
    expect(feature?.summary).toBe('(see Actions)');
    expect(feature?.parts).toBeUndefined();

    // The Bonus Action carries the full effect — the benefits the snippet dropped —
    // trimmed of its lead-in flavor and the recharge line (shown as use checkboxes).
    const action = character.actions.find(
      (entry) => entry.name === 'Innate Sorcery' && entry.category === 'bonus',
    );
    expect(action?.summary).toBe(
      'As a Bonus Action, you can unleash that magic for 1 minute, during which you gain ' +
        'the following benefits: The spell save DC of your Sorcerer spells increases by 1. ' +
        'You have Advantage on the attack rolls of Sorcerer spells you cast.',
    );
    expect(action?.summary).not.toMatch(/an event in your past|regain all expended uses/i);

    // A passive "other" option that merely shares a name with an action is NOT
    // collapsed — it keeps its own description in the feature list.
    expect(featureNamed('Sorcerous Restoration')?.summary).toContain(
      'regain expended Sorcery Points',
    );
    expect(featureNamed('Empowered Spell')?.summary).toContain('reroll up to 4 damage dice');
  });

  it('tracks a racial trait that grants limited-use spells', () => {
    const { features } = normalizeCharacter(raw);
    const legacy = features
      .flatMap((group) => group.items)
      .find((item) => item.name === 'Fiendish Legacy Spells');
    // Tiefling's Fiendish Legacy grants Hellish Rebuke and Darkness once per long rest.
    expect(legacy?.spellUses?.map((use) => use.name)).toEqual(
      expect.arrayContaining(['Hellish Rebuke', 'Darkness']),
    );
  });

  it('decodes HTML entities in feature text', () => {
    const metamagic = normalizeCharacter(raw)
      .features.flatMap((group) => group.items)
      .find((item) => item.name === 'Metamagic');
    // The Metamagic description references &ldquo;Metamagic Options&rdquo; — the
    // curly-quote entities should be decoded, not rendered raw.
    expect(metamagic?.summary).toContain('"Metamagic Options"');
    expect(metamagic?.summary).not.toMatch(/&(?:ldquo|rdquo|amp|#\d+);/);
  });
});
