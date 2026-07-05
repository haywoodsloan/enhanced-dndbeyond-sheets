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

/** Broad armor categories that determine how Dexterity applies to AC. */
export type ArmorCategory = 'none' | 'light' | 'medium' | 'heavy';

export interface ArmorClassInput {
  category: ArmorCategory;
  /** Base AC printed on the worn armor. Ignored when category is 'none'. */
  armorBase?: number;
  dexModifier: number;
  /** Bonus from an equipped shield (typically +2). */
  shieldBonus?: number;
  /** Flat AC bonuses from magic items, feats, etc. */
  bonus?: number;
}

/**
 * Compute Armor Class from equipped armor. Light armor adds full Dex, medium
 * caps Dex at +2, heavy ignores Dex, and unarmored is 10 + Dex. Shield and flat
 * bonuses are added on top. Class features that change the base (Barbarian/Monk
 * unarmored defense) are not modeled here.
 */
export function armorClass(input: ArmorClassInput): number {
  const { category, dexModifier, armorBase = 0, shieldBonus = 0, bonus = 0 } = input;
  let base: number;
  switch (category) {
    case 'light':
      base = armorBase + dexModifier;
      break;
    case 'medium':
      base = armorBase + Math.min(dexModifier, 2);
      break;
    case 'heavy':
      base = armorBase;
      break;
    default:
      base = 10 + dexModifier;
  }
  return base + shieldBonus + bonus;
}

export interface MaxHitPointsInput {
  /** Hit points from hit dice, excluding the Constitution contribution. */
  base: number;
  conModifier: number;
  level: number;
  /** Flat max-HP bonus (e.g. from a feat). */
  bonus?: number;
  /** When set, replaces the computed maximum entirely. */
  override?: number | null;
}

/** Maximum hit points: base + Con modifier per level + flat bonus, or an override. */
export function maxHitPoints(input: MaxHitPointsInput): number {
  if (input.override != null) return input.override;
  return input.base + input.conModifier * input.level + (input.bonus ?? 0);
}

/** The standard conditions keyed by their D&D Beyond definition id. */
export const CONDITIONS: Readonly<Record<number, string>> = {
  1: 'Blinded',
  2: 'Charmed',
  3: 'Deafened',
  4: 'Exhaustion',
  5: 'Frightened',
  6: 'Grappled',
  7: 'Incapacitated',
  8: 'Invisible',
  9: 'Paralyzed',
  10: 'Petrified',
  11: 'Poisoned',
  12: 'Prone',
  13: 'Restrained',
  14: 'Stunned',
  15: 'Unconscious',
};

/** Look up a condition name by its D&D Beyond id, or undefined if unknown. */
export function conditionName(id: number | undefined): string | undefined {
  return id == null ? undefined : CONDITIONS[id];
}

/**
 * All standard condition names in canonical order. Derived from `CONDITIONS`
 * (integer keys iterate in ascending order) so it never drifts from the map.
 */
export const CONDITION_NAMES: readonly string[] = Object.values(CONDITIONS);
