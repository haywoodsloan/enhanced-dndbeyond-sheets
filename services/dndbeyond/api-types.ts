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
  classFeatures?: RawClassFeature[];
}

export interface RawSubclassDefinition {
  name?: string;
}

export interface RawClassFeature {
  name?: string;
  requiredLevel?: number;
}

export interface RawGrantedFeature {
  definition?: { name?: string; hideInSheet?: boolean };
}

export interface RawCharacterClass {
  level: number;
  definition: RawClassDefinition;
  subclassDefinition?: RawSubclassDefinition | null;
  classFeatures?: RawGrantedFeature[];
}

export interface RawRacialTrait {
  definition?: { name?: string; hideInSheet?: boolean };
}

export interface RawRace {
  fullName?: string;
  baseRaceName?: string;
  racialTraits?: RawRacialTrait[];
  weightSpeeds?: {
    normal?: { walk?: number | null } | null;
  } | null;
}

export interface RawBackground {
  definition?: { name?: string } | null;
}

export interface RawInventoryItem {
  id: number;
  displayAsAttack?: boolean | null;
  equipped?: boolean | null;
  isAttuned?: boolean | null;
  quantity?: number;
  definition?: {
    name?: string;
    filterType?: string;
    armorClass?: number | null;
    armorTypeId?: number | null;
  };
}

export interface RawSpell {
  definition?: {
    name?: string;
    level?: number;
  };
}

export interface RawFeat {
  definition?: { name?: string };
}

export interface RawClassSpellGroup {
  characterClassId?: number;
  spells?: RawSpell[];
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

/** Coin counts held by the character. */
export interface RawCurrencies {
  cp?: number;
  sp?: number;
  ep?: number;
  gp?: number;
  pp?: number;
}

/** A single entry from the source-grouped `modifiers` map. */
export interface RawModifier {
  type?: string;
  subType?: string;
  value?: number | null;
  fixedValue?: number | null;
  friendlySubtypeName?: string;
}

/** An active condition entry; `id` maps to a standard 5e condition. */
export interface RawCondition {
  id?: number;
  level?: number | null;
}

export interface RawCharacter {
  id: number;
  name: string;
  baseHitPoints?: number | null;
  bonusHitPoints?: number | null;
  overrideHitPoints?: number | null;
  removedHitPoints?: number | null;
  temporaryHitPoints?: number | null;
  stats: RawStat[];
  bonusStats?: RawStat[];
  overrideStats?: RawStat[];
  classes: RawCharacterClass[];
  race?: RawRace | null;
  background?: RawBackground | null;
  inventory?: RawInventoryItem[];
  classSpells?: RawClassSpellGroup[];
  spells?: RawSourceMap<RawSpell> | null;
  actions?: RawSourceMap<RawAction> | null;
  feats?: RawFeat[];
  optionalClassFeatures?: unknown[];
  conditions?: RawCondition[] | null;
  currencies?: RawCurrencies | null;
  modifiers?: RawSourceMap<RawModifier> | null;
}
