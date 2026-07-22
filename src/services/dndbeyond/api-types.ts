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
  /** Hit die size for this class (e.g. 8 means a d8). */
  hitDice?: number | null;
  spellRules?: RawSpellRules | null;
  classFeatures?: RawClassFeature[];
}

export interface RawSubclassDefinition {
  name?: string;
  canCastSpells?: boolean;
  spellCastingAbilityId?: number | null;
}

export interface RawSpellRules {
  /** Multiclass effective-caster divisor (1 full, 2 half, 3 third). */
  multiClassSpellSlotDivisor?: number | null;
  /** D&D Beyond rounding: 1 down, 2 up. */
  multiClassSpellSlotRounding?: number | null;
  /** Per class level (index), then slots by spell level (index 0 = level 1). */
  levelSpellSlots?: number[][] | null;
}

export interface RawClassFeature {
  id?: number;
  name?: string;
  hideInSheet?: boolean;
  requiredLevel?: number;
  snippet?: string | null;
  description?: string | null;
  levelScales?: RawLevelScale[] | null;
}

export interface RawLevelScale {
  level?: number | null;
  fixedValue?: number | null;
  dice?: RawDice | null;
}

export interface RawGrantedFeature {
  /** Scale entry active at the character's current class level. */
  levelScale?: RawLevelScale | null;
  definition?: {
    id?: number;
    name?: string;
    hideInSheet?: boolean;
    /** Character level at which this feature is granted; gate display on it. */
    requiredLevel?: number;
    snippet?: string | null;
    description?: string | null;
    levelScales?: RawLevelScale[] | null;
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
  size?: string | null;
  sizeId?: number | null;
  creatureTypeId?: number | null;
  racialTraits?: RawRacialTrait[];
  weightSpeeds?: {
    normal?: {
      walk?: number | null;
      fly?: number | null;
      swim?: number | null;
      climb?: number | null;
      burrow?: number | null;
    } | null;
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
    /** Fixed weapon damage used instead of dice/ability damage (e.g. a Blowgun). */
    fixedDamage?: number | null;
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
  spellCastingAbilityId?: number | null;
  /** Id of the feature/feat/trait (or its option) that granted this spell. */
  componentId?: number | null;
  componentTypeId?: number | null;
  /** Free-cast pool when a feature grants a capped number of casts (e.g. 1/LR). */
  limitedUse?: RawLimitedUse | null;
}

/** A tag on a feat's definition; `__DISGUISE_FEAT` marks a non-feat placeholder. */
export interface RawFeatCategory {
  tagName?: string;
  entityTypeId?: number;
}

export interface RawFeat {
  definition?: {
    id?: number;
    name?: string;
    hideInSheet?: boolean;
    snippet?: string | null;
    description?: string | null;
    /** Origin tags; a `__DISGUISE_FEAT` tag means this isn't a real feat. */
    categories?: RawFeatCategory[] | null;
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
  /** Entity type of the grantor (class-feature / feat / racial-trait / …). */
  componentTypeId?: number | null;
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
  isProficient?: boolean | null;
  toHitBonus?: number | null;
  damageBonus?: number | null;
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

export interface RawCustomAction {
  name?: string | null;
  description?: string | null;
  snippet?: string | null;
  displayAsAttack?: boolean | null;
  isProficient?: boolean | null;
  statId?: number | null;
  toHitBonus?: number | null;
  damageBonus?: number | null;
  diceCount?: number | null;
  diceType?: number | null;
  fixedValue?: number | null;
  damageTypeId?: number | null;
  saveStatId?: number | null;
  fixedSaveDc?: number | null;
  range?: number | null;
  longRange?: number | null;
  aoeType?: number | null;
  aoeSize?: number | null;
  activationTime?: number | null;
  activationType?: number | null;
}

/**
 * D&D Beyond groups many collections by source (`race`, `class`, `background`,
 * `item`, `feat`). Values are arrays, but can be `null` when a source grants
 * nothing.
 */
export type RawSourceMap<T> = Record<string, T[] | null | undefined>;

/**
 * A single *selected* option for a "choose one" feature. `componentId` is the id
 * of the feature that offered the choice; `definition` describes the picked
 * option (e.g. the chosen Elven lineage).
 */
export interface RawSelectedOption {
  componentId?: number | null;
  componentTypeId?: number | null;
  definition?: {
    id?: number;
    name?: string | null;
    snippet?: string | null;
    description?: string | null;
  } | null;
}

/** The character's selected options, grouped by source. */
export interface RawCharacterOptions {
  race?: RawSelectedOption[] | null;
  class?: RawSelectedOption[] | null;
  feat?: RawSelectedOption[] | null;
  background?: RawSelectedOption[] | null;
  item?: RawSelectedOption[] | null;
}

export interface RawChoice {
  componentId?: number | null;
  componentTypeId?: number | null;
  optionValue?: number | null;
  optionIds?: number[] | null;
  label?: string | null;
}

export interface RawChoiceDefinition {
  id?: string;
  options?: {
    id?: number;
    label?: string | null;
    description?: string | null;
  }[] | null;
}

export interface RawCharacterValue {
  typeId?: number | null;
  value?: number | string | null;
  valueId?: number | string | null;
  valueTypeId?: number | null;
  notes?: string | null;
}

export interface RawCustomProficiency {
  /** 1 = skill, 2 = tool, 3 = language. */
  type?: number | null;
  name?: string | null;
  /** Governing ability id for a custom skill. */
  statId?: number | null;
  /** 1 none, 2 half, 3 proficient, 4 expertise. */
  proficiencyLevel?: number | null;
  miscBonus?: number | string | null;
  magicBonus?: number | string | null;
}

export interface RawCustomSense {
  /** 1 blindsight, 2 darkvision, 3 tremorsense, 4 truesight. */
  senseId?: number | null;
  distance?: number | null;
}

export interface RawCustomSpeed {
  /** 1 walk, 2 burrow, 3 climb, 4 fly, 5 swim. */
  movementId?: number | null;
  distance?: number | null;
}

export interface RawCustomItem {
  id?: number | string | null;
  name?: string | null;
  quantity?: number | null;
  equipped?: boolean | null;
  isAttuned?: boolean | null;
  definition?: { name?: string | null } | null;
}

export interface RawCustomDefenseAdjustment {
  /** 1 = condition immunity, 2 = damage adjustment. */
  type?: number | null;
  /** Dictionary id identifying the exact resistance/immunity/vulnerability. */
  adjustmentId?: number | null;
}

export interface RawCharacterChoices {
  race?: RawChoice[] | null;
  class?: RawChoice[] | null;
  feat?: RawChoice[] | null;
  background?: RawChoice[] | null;
  item?: RawChoice[] | null;
  choiceDefinitions?: RawChoiceDefinition[] | null;
}

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
  /** Ability id whose modifier supplies this dynamic bonus. */
  statId?: number | null;
  /** Id of the feature/feat/trait that granted this modifier. */
  componentId?: number | null;
  /** Dice for a damage/healing modifier (e.g. a spell's damage). */
  die?: RawDice | null;
  /** Scaling attached directly to this modifier in newer spell definitions. */
  atHigherLevels?: {
    higherLevelDefinitions?: { level?: number | null; dice?: RawDice | null }[] | null;
  } | null;
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
  /** User-entered overrides/custom bonuses; typeId 1 is Armor Class override. */
  characterValues?: RawCharacterValue[] | null;
  customProficiencies?: RawCustomProficiency[] | null;
  customSenses?: RawCustomSense[] | null;
  customSpeeds?: RawCustomSpeed[] | null;
  customItems?: RawCustomItem[] | null;
  customActions?: RawCustomAction[] | null;
  customDefenseAdjustments?: RawCustomDefenseAdjustment[] | null;
  /** Heroic Inspiration flag. */
  inspiration?: boolean | null;
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
  /** Selected "choose one" options, keyed by the offering feature's id. */
  options?: RawCharacterOptions | null;
  /** Builder choice records, including required choices not yet resolved. */
  choices?: RawCharacterChoices | null;
  optionalClassFeatures?: unknown[];
  conditions?: RawCondition[] | null;
  currencies?: RawCurrencies | null;
  modifiers?: RawSourceMap<RawModifier> | null;
  notes?: RawNotes | null;
}
