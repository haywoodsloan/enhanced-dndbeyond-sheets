import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RawCharacter } from '@/services/dndbeyond/api-types';
import { normalizeCharacter } from '@/services/dndbeyond/normalize';

const directory = resolve('..', 'ddb-sheet-parity', 'data');
const rosterFile = join(directory, 'roster.json');
const roster: { key: string; className: string }[] = existsSync(rosterFile)
  ? JSON.parse(readFileSync(rosterFile, 'utf8')).characters : [];

describe.skipIf(!roster.length)('local owned-payload roster (no network or checked-in raw data)', () => {
  it.each(roster)('normalizes $key with complete owned supporting rules', ({ key, className }) => {
    const payload = JSON.parse(readFileSync(join(directory, 'payloads', `${key}.json`), 'utf8'));
    const raw: RawCharacter = payload.data ?? payload;
    const character = normalizeCharacter(raw);
    const text = JSON.stringify(character.features);
    expect(character.id).toBe(raw.id);
    expect(character.abilities).toHaveLength(6);
    expect(character.savingThrows).toHaveLength(6);
    expect(character.skills).toHaveLength(18);
    expect(JSON.stringify(character)).not.toContain('{{');
    expect(character.sections.find((section) => section.key === 'companions')?.count)
      .toBe(character.companions?.length ?? 0);
    expect(character.sections.find((section) => section.key === 'tables')?.count)
      .toBe(character.ruleTables?.length ?? 0);
    expect(character.ruleTables?.some((table) => /^Core .+ Traits$|^Standard Languages$/i.test(table.title))).toBe(false);
    expect(text).not.toContain('Dark Bargain');
    expect(text).not.toContain('Searing Silver');
    expect(character.spells.find((spell) => spell.name === 'Polymorph')?.summary).toMatch(/target (?:only yourself|yourself only)/i);
    if (className === 'Wizard') {
      expect(text).not.toContain('Circle Magic');
    }
    if (className === 'Barbarian' && character.level >= 17) {
      expect(text).toContain('two different Brutal Strike effects');
    }
    if (className === 'Artificer') {
      const choices = raw.options?.class?.filter((option) => option.componentId === 12497143) ?? [];
      for (const choice of choices) expect(text).toContain(choice.definition?.name);
      expect(JSON.stringify([character.features, character.spellcasting])).toContain('focuses in hand');
    }
    if (key === 'artificer-alchemist') {
      const table = character.ruleTables?.find((entry) => entry.title === 'Experimental Elixir');
      expect(table?.rows).toHaveLength(6);
      expect(JSON.stringify(table)).toContain('15 (4d8)');
      const tinker = character.ruleTables?.filter((entry) => /Tinker.*Magic/i.test(entry.source));
      expect(tinker).toHaveLength(1);
      expect(tinker?.[0].rows).toHaveLength(11);
    }
    if (key === 'artificer-battle-smith') {
      expect(text).toContain('first one vanishes');
      expect(character.companions?.filter((entry) => entry.name === 'Steel Defender')).toHaveLength(1);
    }
    if (key === 'artificer-armorer') {
      expect(text).toContain('model whenever you finish a Short or Long Rest');
      expect(text).toMatch(/Smith.s Tools in hand/);
    }
    if (key === 'ranger-hunter') {
      expect(text.match(/replace the chosen option with the other one/g)?.length).toBeGreaterThanOrEqual(2);
    }
    if (key === 'ranger-beast-master') {
      const beasts = character.companions?.filter((entry) => entry.name === 'Beast of the Land');
      expect(beasts).toHaveLength(1);
      expect(JSON.stringify(beasts)).toContain('target has the Prone condition');
    }
    if (key === 'fighter-eldritch-knight' || key === 'rogue-arcane-trickster') {
      const table = character.ruleTables?.find((entry) => /Spellcasting/.test(entry.title));
      expect(table?.columns).toHaveLength(6);
      expect(table?.columns.slice(2)).toEqual(['1', '2', '3', '4']);
      expect(table?.rows).toHaveLength(18);
      expect(table?.rows.every((row) => row.length === 6)).toBe(true);
    }
  });
});
