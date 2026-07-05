/**
 * Internal, normalized character model used throughout the extension. This is
 * decoupled from D&D Beyond's raw API shape (see `api-types.ts`) so the rest of
 * the app depends on a stable structure.
 */

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

export interface Character {
  id: number;
  name: string;
  race?: string;
  background?: string;
  classes: CharacterClassSummary[];
  /** Sum of all class levels. */
  level: number;
  sections: CharacterSection[];
}
