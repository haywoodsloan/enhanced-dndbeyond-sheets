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
  /** Ability id used for this class's spellcasting (see ABILITIES). */
  spellCastingAbilityId?: number | null;
  classFeatures?: RawClassFeature[];
}

export interface RawSubclassDefinition {
  name?: string;
}

export interface RawClassFeature {
  id?: number;
  name?: string;
  requiredLevel?: number;
  snippet?: string | null;
  description?: string | null;
}

export interface RawGrantedFeature {
  definition?: {
    id?: number;
    name?: string;
    hideInSheet?: boolean;
    snippet?: string | null;
    description?: string | null;
  };
}

export interface RawCharacterClass {
  level: number;
  definition: RawClassDefinition;
  subclassDefinition?: RawSubclassDefinition | null;
  classFeatures?: RawGrantedFeature[];
}

export interface RawRacialTrait {
  definition?: {
    id?: number;
    name?: string;
    hideInSheet?: boolean;
    snippet?: string | null;
    description?: string | null;
  };
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
  /** Rules text (HTML + D&D Beyond `[tag]` markup), used for the legend. */
  description?: string | null;
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

/** A spell's rich definition (only the fields the sheet surfaces). */
export interface RawSpellDefinition {
  name?: string;
  level?: number;
  school?: string | null;
  /** Full rules text (HTML) and a short summary, for the spell blurb. */
  description?: string | null;
  snippet?: string | null;
  duration?: {
    durationInterval?: number | null;
    durationUnit?: string | null;
    durationType?: string | null;
  } | null;
  activation?: { activationTime?: number | null; activationType?: number | null } | null;
  range?: {
    origin?: string | null;
    rangeValue?: number | null;
    aoeType?: string | number | null;
    aoeValue?: number | null;
  } | null;
  /** Component ids: 1 = Verbal, 2 = Somatic, 3 = Material. */
  components?: number[] | null;
  componentsDescription?: string | null;
  concentration?: boolean;
  ritual?: boolean;
  requiresSavingThrow?: boolean;
  requiresAttackRoll?: boolean;
  /** Ability id the target saves with (see ABILITIES). */
  saveDcAbilityId?: number | null;
  /** Effect modifiers; the damage ones carry a `die`. */
  modifiers?: RawModifier[] | null;
  /** Upcast scaling: dice added per slot level above the spell's own. */
  atHigherLevels?: { higherLevelDefinitions?: { dice?: RawDice | null }[] | null } | null;
  /** "characterlevel" (cantrip), "spellscale"/"spelllevel" (upcast), or null. */
  scaleType?: string | null;
  tags?: string[] | null;
}

export interface RawSpell {
  definition?: RawSpellDefinition;
  prepared?: boolean;
}

export interface RawFeat {
  definition?: {
    id?: number;
    name?: string;
    snippet?: string | null;
    description?: string | null;
  };
}

export interface RawClassSpellGroup {
  characterClassId?: number;
  spells?: RawSpell[];
}

export interface RawAction {
  name?: string;
  /** Id of the feature/feat/trait this action comes from (see resource pools). */
  componentId?: number | null;
  /** Full rules text (HTML) and a short summary, for the action blurb. */
  description?: string | null;
  snippet?: string | null;
  displayAsAttack?: boolean | null;
  activation?: { activationType?: number | null } | null;
  /** Limited-use pool (checkbox resource) when the action is rationed. */
  limitedUse?: RawLimitedUse | null;
  /** Damage dice, when the action deals damage. */
  dice?: RawDice | null;
  /** Ability id whose modifier is added to the action's damage/effect. */
  abilityModifierStatId?: number | null;
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
  /** Dice for a damage/healing modifier (e.g. a spell's damage). */
  die?: RawDice | null;
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
