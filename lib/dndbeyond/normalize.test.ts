import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { RawCharacter } from './api-types';
import { normalizeCharacter } from './normalize';

// Load the fixture from disk (not a JSON import) to keep type-checking fast and
// avoid inferring a giant literal type from the ~550 KB file. Vitest runs with
// the project root as the working directory.
const raw = JSON.parse(
  readFileSync('lib/dndbeyond/fixtures/noct.json', 'utf-8'),
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

  it('produces all five sections in a stable order', () => {
    const character = normalizeCharacter(raw);
    expect(character.sections.map((section) => section.key)).toEqual([
      'attributes',
      'attacks',
      'spells',
      'inventory',
      'features',
    ]);
  });

  it('counts section contents', () => {
    const character = normalizeCharacter(raw);
    const counts = Object.fromEntries(
      character.sections.map((section) => [section.key, section.count]),
    );
    expect(counts).toEqual({
      attributes: 6,
      attacks: 1,
      spells: 18,
      inventory: 24,
      features: 39,
    });
  });

  it('flags a section empty exactly when its count is zero', () => {
    const character = normalizeCharacter(raw);
    for (const section of character.sections) {
      expect(section.isEmpty).toBe(section.count === 0);
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
