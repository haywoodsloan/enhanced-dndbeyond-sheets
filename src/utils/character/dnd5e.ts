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

/** The ability key for a D&D Beyond stat id (1 = STR … 6 = CHA), or undefined. */
export function abilityKeyById(id: number | null | undefined): AbilityKey | undefined {
  return ABILITIES.find((ability) => ability.id === id)?.key;
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

/**
 * Spell slots by effective caster level (index 0 = caster level 0). Each row is
 * the slot count per spell level (index 0 = 1st-level slots). This is the
 * standard 5e Multiclass Spellcaster table, which also covers single-class
 * casters. D&D Beyond's payload doesn't reliably store max slots, so they're
 * derived from the caster level instead.
 */
export const SPELL_SLOTS_BY_CASTER_LEVEL: readonly (readonly number[])[] = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Spell slots per spell level for an effective caster level (clamped 0..20). */
export function spellSlotsForCasterLevel(casterLevel: number): number[] {
  const clamped = Math.max(0, Math.min(20, Math.floor(casterLevel)));
  return [...SPELL_SLOTS_BY_CASTER_LEVEL[clamped]];
}

/**
 * How many times a cantrip's base damage dice roll at a character level. Cantrips
 * scale at levels 5, 11, and 17 (×1 / ×2 / ×3 / ×4).
 */
export function cantripDiceMultiplier(characterLevel: number): number {
  return characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1;
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
  /** Extra bonus used only by an unarmored AC formula (e.g. Con/Wis/Cha). */
  unarmoredBonus?: number;
  /** Maximum Dexterity modifier allowed by medium armor (normally +2). */
  mediumDexCap?: number;
}

/**
 * Compute Armor Class from equipped armor. Light armor adds full Dex, medium
 * caps Dex at +2, heavy ignores Dex, and unarmored is 10 + Dex. Shield and flat
 * bonuses are added on top. Class features that change the base (Barbarian/Monk
 * unarmored defense) are not modeled here.
 */
export function armorClass(input: ArmorClassInput): number {
  const {
    category,
    dexModifier,
    armorBase = 0,
    shieldBonus = 0,
    bonus = 0,
    unarmoredBonus = 0,
    mediumDexCap = 2,
  } = input;
  let base: number;
  switch (category) {
    case 'light':
      base = armorBase + dexModifier;
      break;
    case 'medium':
      base = armorBase + Math.min(dexModifier, mediumDexCap);
      break;
    case 'heavy':
      base = armorBase;
      break;
    default:
      base = 10 + dexModifier + unarmoredBonus;
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

/** Damage types keyed by their D&D Beyond definition id. */
export const DAMAGE_TYPES: Readonly<Record<number, string>> = {
  1: 'Bludgeoning',
  2: 'Piercing',
  3: 'Slashing',
  4: 'Necrotic',
  5: 'Acid',
  6: 'Cold',
  7: 'Fire',
  8: 'Lightning',
  9: 'Thunder',
  10: 'Poison',
  11: 'Psychic',
  12: 'Radiant',
  13: 'Force',
};

/** Look up a damage-type name by its D&D Beyond id, or undefined if unknown. */
export function damageTypeName(id: number | null | undefined): string | undefined {
  return id == null ? undefined : DAMAGE_TYPES[id];
}

/** A spell school's periodic-table symbol and accent colour. */
export interface SpellSchoolStyle {
  abbr: string;
  color: string;
}

/** The eight schools of magic, each with a 2-letter symbol and accent colour. */
export const SPELL_SCHOOLS: Readonly<Record<string, SpellSchoolStyle>> = {
  Abjuration: { abbr: 'Ab', color: '#3b82f6' },
  Conjuration: { abbr: 'Cj', color: '#f59e0b' },
  Divination: { abbr: 'Dv', color: '#06b6d4' },
  Enchantment: { abbr: 'En', color: '#ec4899' },
  Evocation: { abbr: 'Ev', color: '#ef4444' },
  Illusion: { abbr: 'Il', color: '#8b5cf6' },
  Necromancy: { abbr: 'Nc', color: '#10b981' },
  Transmutation: { abbr: 'Tr', color: '#84cc16' },
};

/** School symbol + colour, falling back to a neutral style for unknown schools. */
export function spellSchoolStyle(school: string | undefined): SpellSchoolStyle {
  return (
    (school ? SPELL_SCHOOLS[school] : undefined) ?? {
      abbr: school ? school.slice(0, 2) : '—',
      color: '#6b7280',
    }
  );
}

/** How strongly a proficiency applies to a skill or save. */
export type ProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise';

const PROFICIENCY_MULTIPLIER: Record<ProficiencyLevel, number> = {
  none: 0,
  half: 0.5,
  proficient: 1,
  expertise: 2,
};

/**
 * The bonus a proficiency level contributes given the proficiency bonus. Half
 * proficiency rounds down.
 */
export function proficiencyContribution(
  level: ProficiencyLevel,
  proficiencyBonus: number,
): number {
  return Math.floor(proficiencyBonus * PROFICIENCY_MULTIPLIER[level]);
}

export interface SkillMeta {
  key: string;
  name: string;
  ability: AbilityKey;
  /** D&D Beyond skill value id used by characterValues customizations. */
  valueId: number;
}

/** The 18 standard skills with their governing ability. */
export const SKILLS: readonly SkillMeta[] = [
  { key: 'acrobatics', name: 'Acrobatics', ability: 'dex', valueId: 3 },
  { key: 'animal-handling', name: 'Animal Handling', ability: 'wis', valueId: 11 },
  { key: 'arcana', name: 'Arcana', ability: 'int', valueId: 6 },
  { key: 'athletics', name: 'Athletics', ability: 'str', valueId: 2 },
  { key: 'deception', name: 'Deception', ability: 'cha', valueId: 16 },
  { key: 'history', name: 'History', ability: 'int', valueId: 7 },
  { key: 'insight', name: 'Insight', ability: 'wis', valueId: 12 },
  { key: 'intimidation', name: 'Intimidation', ability: 'cha', valueId: 17 },
  { key: 'investigation', name: 'Investigation', ability: 'int', valueId: 8 },
  { key: 'medicine', name: 'Medicine', ability: 'wis', valueId: 13 },
  { key: 'nature', name: 'Nature', ability: 'int', valueId: 9 },
  { key: 'perception', name: 'Perception', ability: 'wis', valueId: 14 },
  { key: 'performance', name: 'Performance', ability: 'cha', valueId: 18 },
  { key: 'persuasion', name: 'Persuasion', ability: 'cha', valueId: 19 },
  { key: 'religion', name: 'Religion', ability: 'int', valueId: 10 },
  { key: 'sleight-of-hand', name: 'Sleight of Hand', ability: 'dex', valueId: 4 },
  { key: 'stealth', name: 'Stealth', ability: 'dex', valueId: 5 },
  { key: 'survival', name: 'Survival', ability: 'wis', valueId: 15 },
];
