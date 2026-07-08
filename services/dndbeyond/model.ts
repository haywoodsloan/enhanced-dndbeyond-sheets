/**
 * Internal, normalized character model used throughout the extension. This is
 * decoupled from D&D Beyond's raw API shape (see `api-types.ts`) so the rest of
 * the app depends on a stable structure.
 */
import type { AbilityKey, ProficiencyLevel } from '@/utils/dnd5e';
/** The character-sheet sections this extension knows how to lay out. */
export const SECTION_KEYS = [
  'portrait',
  'basics',
  'attributes',
  'skills',
  'savingThrows',
  'senses',
  'proficiencies',
  'actions',
  'spells',
  'inventory',
  'wealth',
  'features',
  'notes',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export interface CharacterSection {
  key: SectionKey;
  title: string;
  /** Number of entries in the section. */
  count: number;
  /** True when `count === 0`. Used later to auto-hide empty sections. */
  isEmpty: boolean;
}

export interface CharacterClassSummary {
  name: string;
  level: number;
  subclass?: string;
}

/** A single ability score with its derived modifier. */
export interface AbilityScore {
  key: AbilityKey;
  /** Full ability name, e.g. "Strength". */
  name: string;
  /** Final score after bonuses and overrides. */
  score: number;
  /** Modifier derived from `score` via the 5e formula. */
  modifier: number;
}

/** Current, maximum, and temporary hit points. */
export interface HitPoints {
  current: number;
  max: number;
  temp: number;
}

/** At-a-glance combat and vital stats shown in the Basics section. */
export interface CharacterBasics {
  armorClass: number;
  /** Initiative modifier (signed). */
  initiative: number;
  /** Walking speed in feet. */
  speed: number;
  proficiencyBonus: number;
  hitPoints: HitPoints;
  /** Active condition names; empty when none. */
  conditions: string[];
}

/** A single saving throw with its total modifier and proficiency. */
export interface SavingThrow {
  key: AbilityKey;
  name: string;
  /** Total save modifier (signed). */
  modifier: number;
  proficient: boolean;
}

/** A single skill with its total modifier, governing ability, and proficiency. */
export interface Skill {
  key: string;
  name: string;
  ability: AbilityKey;
  modifier: number;
  proficiency: ProficiencyLevel;
}

/** Non-skill proficiencies grouped for the Proficiencies & Training section. */
export interface CharacterProficiencies {
  languages: string[];
  armor: string[];
  weapons: string[];
  tools: string[];
}

/** How an action is activated. Also the display order of the groups. */
export type ActionCategory = 'action' | 'bonus' | 'reaction' | 'other';

/** A named action, attack, reaction, or other activatable option. */
export interface CharacterAction {
  name: string;
  /** Activation category used to group and order actions. */
  category: ActionCategory;
}

/** A known or prepared spell. */
export interface SpellEntry {
  name: string;
  /** Spell level; 0 for cantrips. */
  level: number;
}

/** A carried inventory item. */
export interface InventoryEntry {
  name: string;
  quantity: number;
  equipped: boolean;
  attuned: boolean;
}

/** Coin counts held by the character. */
export interface Coins {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

/** A labeled group of features/traits (e.g. Class Features, Racial Traits). */
export interface FeatureGroup {
  label: string;
  items: string[];
}

/** A labeled free-text note (backstory, allies, possessions, etc.). */
export interface NoteEntry {
  label: string;
  text: string;
}

/** A passive score or special sense, split into a label and its value. */
export interface SenseEntry {
  label: string;
  /** The displayable value, e.g. "14" or "60 ft.". */
  value: string;
}

export interface Character {
  id: number;
  name: string;
  race?: string;
  background?: string;
  /** Portrait image URL, if the character has one. */
  avatarUrl?: string;
  classes: CharacterClassSummary[];
  /** Sum of all class levels. */
  level: number;
  /** The six ability scores in canonical order (STR … CHA). */
  abilities: AbilityScore[];
  /** Combat and vital stats for the Basics section. */
  basics: CharacterBasics;
  /** The six saving throws in canonical order. */
  savingThrows: SavingThrow[];
  /** Defensive traits: resistances, immunities, and save advantages. */
  defences: string[];
  /** Passive skill scores and special senses (darkvision, etc.). */
  senses: SenseEntry[];
  /** The 18 skills in canonical order. */
  skills: Skill[];
  /** Language and training proficiencies. */
  proficiencies: CharacterProficiencies;
  /** Attacks and other actions. */
  actions: CharacterAction[];
  /** Known/prepared spells. */
  spells: SpellEntry[];
  /** Carried items. */
  inventory: InventoryEntry[];
  /** Coins held. */
  wealth: Coins;
  /** Features and traits, grouped by source. */
  features: FeatureGroup[];
  /** Free-text notes (backstory, allies, possessions, etc.). */
  notes: NoteEntry[];
  sections: CharacterSection[];
}
