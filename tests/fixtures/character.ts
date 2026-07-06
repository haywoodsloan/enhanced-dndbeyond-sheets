import type { Character } from '@/services/dndbeyond/model';

/**
 * Build a complete `Character` for tests, overriding only the fields a test
 * cares about. Keeps test setup terse and shields tests from new model fields.
 */
export function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 1,
    name: 'Test',
    classes: [],
    level: 1,
    abilities: [],
    basics: {
      armorClass: 10,
      initiative: 0,
      speed: 30,
      proficiencyBonus: 2,
      hitPoints: { current: 10, max: 10, temp: 0 },
      conditions: [],
    },
    savingThrows: [],
    skills: [],
    proficiencies: { languages: [], armor: [], weapons: [], tools: [] },
    actions: [],
    spells: [],
    inventory: [],
    wealth: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    features: [],
    sections: [],
    ...overrides,
  };
}
