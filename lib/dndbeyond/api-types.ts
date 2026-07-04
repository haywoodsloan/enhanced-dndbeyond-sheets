/**
 * Types for the subset of D&D Beyond's character-service API response that this
 * extension consumes. These describe the RAW shape returned by the endpoint
 * `https://character-service.dndbeyond.com/character/v5/character/{id}` and are
 * intentionally partial — only fields the normalizer reads are modeled.
 */

/** Envelope returned by the character-service endpoint. */
export interface DdbApiResponse {
  id: number;
  success: boolean;
  message: string | null;
  data: RawCharacter | null;
}

/** One of the six ability score entries (id 1..6). */
export interface RawStat {
  id: number;
  name: string | null;
  value: number | null;
}

export interface RawClassDefinition {
  name?: string;
  canCastSpells?: boolean;
}

export interface RawSubclassDefinition {
  name?: string;
}

export interface RawCharacterClass {
  level: number;
  definition: RawClassDefinition;
  subclassDefinition?: RawSubclassDefinition | null;
  classFeatures?: unknown[];
}

export interface RawRacialTrait {
  definition?: { name?: string };
}

export interface RawRace {
  fullName?: string;
  baseRaceName?: string;
  racialTraits?: RawRacialTrait[];
}

export interface RawBackground {
  definition?: { name?: string } | null;
}

export interface RawInventoryItem {
  id: number;
  displayAsAttack?: boolean | null;
  equipped?: boolean | null;
  quantity?: number;
  definition?: {
    name?: string;
    filterType?: string;
  };
}

export interface RawClassSpellGroup {
  characterClassId?: number;
  spells?: unknown[];
}

export interface RawAction {
  name?: string;
  displayAsAttack?: boolean | null;
}

/**
 * D&D Beyond groups many collections by source (`race`, `class`, `background`,
 * `item`, `feat`). Values are arrays, but can be `null` when a source grants
 * nothing.
 */
export type RawSourceMap<T> = Record<string, T[] | null | undefined>;

export interface RawCharacter {
  id: number;
  name: string;
  stats: RawStat[];
  bonusStats?: RawStat[];
  overrideStats?: RawStat[];
  classes: RawCharacterClass[];
  race?: RawRace | null;
  background?: RawBackground | null;
  inventory?: RawInventoryItem[];
  classSpells?: RawClassSpellGroup[];
  spells?: RawSourceMap<unknown> | null;
  actions?: RawSourceMap<RawAction> | null;
  feats?: unknown[];
  optionalClassFeatures?: unknown[];
}
