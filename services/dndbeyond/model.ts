/**
 * Internal, normalized character model used throughout the extension. This is
 * decoupled from D&D Beyond's raw API shape (see `api-types.ts`) so the rest of
 * the app depends on a stable structure.
 */
import type { AbilityKey } from '@/utils/dnd5e';
/** The character-sheet sections this extension knows how to lay out. */
export const SECTION_KEYS = [
  'basics',
  'attributes',
  'skills',
  'savingThrows',
  'proficiencies',
  'actions',
  'spells',
  'inventory',
  'wealth',
  'features',
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

export interface Character {
  id: number;
  name: string;
  race?: string;
  background?: string;
  classes: CharacterClassSummary[];
  /** Sum of all class levels. */
  level: number;
  /** The six ability scores in canonical order (STR … CHA). */
  abilities: AbilityScore[];
  sections: CharacterSection[];
}
