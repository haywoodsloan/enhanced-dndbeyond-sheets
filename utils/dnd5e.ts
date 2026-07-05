/**
 * Pure D&D 5e game-rule helpers. These know nothing about D&D Beyond's API
 * shape — they operate on plain numbers so they can be unit-tested in isolation
 * and reused by the normalizer and the UI alike.
 */

/** The six abilities, keyed by their conventional three-letter abbreviation. */
export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface AbilityMeta {
  /** D&D Beyond stat id, matching the canonical 5e order (1 = STR … 6 = CHA). */
  id: number;
  key: AbilityKey;
  name: string;
}

/** The six abilities in canonical order (STR, DEX, CON, INT, WIS, CHA). */
export const ABILITIES: readonly AbilityMeta[] = [
  { id: 1, key: 'str', name: 'Strength' },
  { id: 2, key: 'dex', name: 'Dexterity' },
  { id: 3, key: 'con', name: 'Constitution' },
  { id: 4, key: 'int', name: 'Intelligence' },
  { id: 5, key: 'wis', name: 'Wisdom' },
  { id: 6, key: 'cha', name: 'Charisma' },
];

/** The 5e ability modifier for a score: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * The 5e proficiency bonus for a character level: ceil(level / 4) + 1. The level
 * is clamped to 1..20 so out-of-range input still yields a sane bonus.
 */
export function proficiencyBonus(level: number): number {
  const clamped = Math.max(1, Math.min(20, Math.floor(level)));
  return Math.ceil(clamped / 4) + 1;
}

/** Format a modifier with an explicit sign, e.g. +2, -1, +0. */
export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}
