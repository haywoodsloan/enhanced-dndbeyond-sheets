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
  id?: number;
  name?: string;
  requiredLevel?: number;
}

export interface RawGrantedFeature {
  definition?: { id?: number; name?: string; hideInSheet?: boolean };
}

export interface RawCharacterClass {
  level: number;
  definition: RawClassDefinition;
  subclassDefinition?: RawSubclassDefinition | null;
  classFeatures?: RawGrantedFeature[];
}

export interface RawRacialTrait {
  definition?: { id?: number; name?: string; hideInSheet?: boolean };
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
    magic?: boolean;
    /** Weapon damage dice (`1d8`, etc.); absent on non-weapons. */
    damage?: RawDice | null;
    /** Weapon damage type name, e.g. "Piercing". */
    damageType?: string | null;
    /** Weapon properties (Finesse, Light, Thrown, …). */
    properties?: RawWeaponProperty[] | null;
    /** 1 = melee, 2 = ranged. */
    attackType?: number | null;
    /** Weapon category: 1 = simple, 2 = martial. */
    categoryId?: number | null;
    /** Normal range / reach in feet. */
    range?: number | null;
    /** Long range in feet (thrown/ranged weapons). */
    longRange?: number | null;
    /** Flat to-hit / damage bonuses granted by a magic weapon. */
    grantedModifiers?: RawModifier[] | null;
  };
}

/** A dice expression from the raw payload (weapon/action/spell damage). */
export interface RawDice {
  diceCount?: number | null;
  diceValue?: number | null;
  diceMultiplier?: number | null;
  fixedValue?: number | null;
  diceString?: string | null;
}

/** A named weapon property (Finesse, Light, Thrown, Versatile, …). */
export interface RawWeaponProperty {
  id?: number;
  name?: string;
}

/** Limited-use resource metadata attached to an action or feature. */
export interface RawLimitedUse {
  name?: string | null;
  maxUses?: number | null;
  numberUsed?: number | null;
  /** Rest that restores uses: 1 = short rest, 2 = long rest. */
  resetType?: number | null;
  /** When true the pool size scales with the proficiency bonus. */
  useProficiencyBonus?: boolean | null;
}

/** Range / area block on an action. */
export interface RawActionRange {
  range?: number | null;
  longRange?: number | null;
  aoeType?: number | null;
  aoeSize?: number | null;
}

export interface RawSpell {
  definition?: {
    name?: string;
    level?: number;
  };
}

export interface RawFeat {
  definition?: { id?: number; name?: string };
}

export interface RawClassSpellGroup {
  characterClassId?: number;
  spells?: RawSpell[];
}

export interface RawAction {
  name?: string;
  /** Id of the feature/feat/trait this action comes from (see resource pools). */
  componentId?: number | null;
  displayAsAttack?: boolean | null;
  activation?: { activationType?: number | null } | null;
  /** Limited-use pool (checkbox resource) when the action is rationed. */
  limitedUse?: RawLimitedUse | null;
  /** Damage dice, when the action deals damage. */
  dice?: RawDice | null;
  /** Flat damage value when there are no dice (e.g. a fixed rider). */
  value?: number | null;
  /** Damage type id (see DAMAGE_TYPES). */
  damageTypeId?: number | null;
  /** Ability id the action forces a save against, when save-based. */
  saveStatId?: number | null;
  /** Explicit save DC, overriding the computed spell save DC. */
  fixedSaveDc?: number | null;
  /** Range / area of the action. */
  range?: RawActionRange | null;
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
  friendlyTypeName?: string;
  friendlySubtypeName?: string;
  restriction?: string | null;
}

/** An active condition entry; `id` maps to a standard 5e condition. */
export interface RawCondition {
  id?: number;
  level?: number | null;
}

/** Free-text note fields from the character's notes tab. */
export interface RawNotes {
  allies?: string | null;
  personalPossessions?: string | null;
  otherHoldings?: string | null;
  organizations?: string | null;
  enemies?: string | null;
  backstory?: string | null;
  otherNotes?: string | null;
}

export interface RawCharacter {
  id: number;
  name: string;
  decorations?: { avatarUrl?: string } | null;
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
  notes?: RawNotes | null;
}
