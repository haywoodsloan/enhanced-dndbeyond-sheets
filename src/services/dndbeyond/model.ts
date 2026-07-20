/**
 * Internal, normalized character model used throughout the extension. This is
 * decoupled from D&D Beyond's raw API shape (see `api-types.ts`) so the rest of
 * the app depends on a stable structure.
 */
import type { AbilityKey, ProficiencyLevel } from '@/utils/character/dnd5e';
/** The character-sheet sections this extension knows how to lay out. */
export const SECTION_KEYS = [
  'portrait',
  'basics',
  'attributes',
  'skills',
  'savingThrows',
  'senses',
  'proficiencies',
  'attacks',
  'actions',
  'spells',
  'companions',
  'tables',
  'inventory',
  'wealth',
  'features',
  'notes',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/**
 * A card's layout key: a fixed section, or a synthetic per-spell card
 * (`spell:<slug>`) when the Spells section is expanded into individual cards.
 * Continuation cards for overflowing content reuse this string with a
 * `<key>~cont~<n>` suffix (see `card-continuation.ts`), cast back to `CardKey`.
 * The layout system (packing, drag, hide, persistence) keys off this string.
 */
export type CardKey = SectionKey | `spell:${string}`;

export interface CharacterSection {
  key: CardKey;
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

/** Hit dice available for short-rest recovery, grouped by die size. */
export interface HitDie {
  /** Die size (e.g. 8 means a d8). */
  die: number;
  /** Number of dice of this size (character levels in classes using it). */
  count: number;
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
  /** Hit dice grouped by die size (highest die first); empty when none. */
  hitDice: HitDie[];
  /** Heroic Inspiration flag. */
  inspiration: boolean;
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
  /** Limited-use pool rendered as empty checkboxes, when the action is rationed. */
  resource?: ResourcePool;
  /** Damage dice, when the action deals damage. */
  damage?: DamageInfo;
  /** Non-damage dice/effect roll, e.g. a Superiority Die or healing roll. */
  roll?: string;
  /** Save prompt, e.g. "DC 14 CON", when the action forces a save. */
  save?: string;
  /** Range / reach shorthand, e.g. "30 ft.". */
  range?: string;
  /** A one-line blurb of what the action does. */
  summary?: string;
}

/** Damage dice (and computed flat bonus) for an attack, action, or spell. */
export interface DamageInfo {
  /** Dice expression, e.g. "1d8"; empty when the damage is a flat value only. */
  dice: string;
  /** Damage type, e.g. "Piercing". */
  type?: string;
  /** Flat modifier added to the roll (ability mod, magic bonus, fixed value). */
  bonus?: number;
  /** What grows with level / upcasting, e.g. "+1d8 per slot above 1st". */
  scaling?: string;
}

/** A weapon (or weapon-like) attack shown in the Attacks card. */
export interface Attack {
  name: string;
  /** To-hit modifier (signed) for an attack-roll attack. */
  toHit?: number;
  /** Save prompt for a save-based attack, e.g. "DC 14 DEX". */
  save?: string;
  /** Damage dice + type + computed flat bonus. */
  damage?: DamageInfo;
  /** Range / reach shorthand, e.g. "5 ft." or "20/60 ft.". */
  range?: string;
  /** Weapon properties (Finesse, Light, …), each with its rules text. */
  properties?: WeaponProperty[];
}

/** A weapon property (Finesse, Light, …) with the rules text for the legend. */
export interface WeaponProperty {
  name: string;
  /** Plain-text rules description, when the source provides one. */
  description?: string;
}

/** A known or prepared spell. */
export interface SpellEntry {
  name: string;
  /** Spell level; 0 for cantrips. */
  level: number;
  /** School of magic, e.g. "Evocation". */
  school?: string;
  /** Casting-time shorthand: "A", "BA", "R", "1m", "1h". */
  castingTime?: string;
  /** Range shorthand, e.g. "60 ft.", "Self", "Touch", "Self (15-ft. cone)". */
  range?: string;
  /** Components present, e.g. "V, S, M". */
  components?: string;
  /** Duration shorthand, e.g. "Instant", "1 min", "Conc, 1 min". */
  duration?: string;
  concentration?: boolean;
  ritual?: boolean;
  /** Save ability abbreviation (e.g. "DEX") when the spell forces a save. */
  save?: string;
  /** True when the spell requires an attack roll. */
  attack?: boolean;
  /** Damage dice + type + upcast scaling. */
  damage?: DamageInfo;
  /** True when the spell is prepared (vs merely known/available). */
  prepared?: boolean;
  /** A one-line blurb of what the spell does. */
  summary?: string;
  /** Named options or rules sections rendered as a semantic list. */
  list?: StructuredList;
  /** Independent feature-granted cast pools (e.g. Augury via Gathered Whispers). */
  featureUses?: FeatureSpellUse[];
  /** Ability used for this spell when a character has multiple casting profiles. */
  ability?: string;
}

/** One feature that grants its own limited pool of casts for a spell. */
export interface FeatureSpellUse {
  /** Display name of the feature that grants the casts. */
  source: string;
  pool: ResourcePool;
}

/** At-a-glance spellcasting stats shown at the top of the Spells card. */
export interface Spellcasting {
  /** One profile per casting class/ability. */
  profiles: SpellcastingProfile[];
  /** Max slots per spell level; index 0 = 1st-level. Trailing zero levels trimmed. */
  slots: number[];
  /** Pact Magic's separate short-rest slot pools, when present. */
  pactSlots?: PactSlotPool[];
}

export interface SpellcastingProfile {
  /** Class/subclass that owns this casting profile. */
  source: string;
  /** Spellcasting ability abbreviation, e.g. "WIS". */
  ability: string;
  modifier: number;
  attack: number;
  saveDc: number;
}

export interface PactSlotPool {
  source: string;
  level: number;
  max: number;
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

/** A limited-use resource shown as N empty print checkboxes to tick by hand. */
export interface ResourcePool {
  /** Number of empty checkboxes to print (the maximum uses). */
  max: number;
  recovery?: ResourceRecovery;
  /** Other ways to restore uses by spending another tracked resource. */
  alternateRecovery?: AlternateRecovery[];
}

export interface AlternateRecovery {
  /** Number of uses restored, or every use. */
  restores: number | 'all';
  /** Display-ready cost, e.g. "1 Superiority Die" or "3 Sorcery Points". */
  cost: string;
}

/** How a limited resource pool recovers expended uses. */
export type ResourceRecovery =
  | { kind: 'rest'; rest: 'short' | 'long' }
  | { kind: 'partial-short-full-long'; shortRestUses: number };

export interface StructuredList {
  /** Optional heading for the list, e.g. "Crafted Gear". */
  label?: string;
  items: { label?: string; text: string }[];
}

/** A named sub-section of a feature (e.g. Circle of Mortality's "Pull of Death"). */
export interface FeaturePart {
  /** The sub-part name; '' for an un-named trailing rider. */
  label: string;
  /** The sub-part text; '' when the detail lives on another card. */
  text: string;
  /** Structured option rows that should render as a list rather than prose. */
  list?: StructuredList;
  /** Dedicated card that owns this part's full mechanics. */
  reference?: SectionKey;
}

/** A single feature/trait, with an optional limited-use resource tracker. */
export interface FeatureItem {
  name: string;
  /** Limited-use pool rendered as empty checkboxes, when the feature is rationed. */
  resource?: ResourcePool;
  /** A one-line blurb of what the feature does (the intro for multi-part features). */
  summary?: string;
  /** Spells added or prepared by this feature; tracking remains on the Spells card. */
  grantedSpells?: string[];
  /** Dedicated card that owns this feature's full mechanics. */
  reference?: SectionKey;
  /** Supporting cards containing structured companion/table details. */
  related?: SectionKey[];
  /** Named sub-parts, when the feature bundles several distinct benefits. */
  parts?: FeaturePart[];
}

/** A labeled group of features/traits (e.g. Class Features, Racial Traits). */
export interface FeatureGroup {
  label: string;
  items: FeatureItem[];
}

export interface CompanionAbility {
  key: string;
  score: string;
  modifier?: string;
  save?: string;
}

export interface CompanionDetail {
  section: string;
  label: string;
  text: string;
}

/** A companion or summon stat block embedded in a feature definition. */
export interface CompanionEntry {
  name: string;
  source: string;
  meta?: string;
  armorClass?: string;
  hitPoints?: string;
  speed?: string;
  abilities: CompanionAbility[];
  details: CompanionDetail[];
}

/** A compact, rollable rules table extracted from a feature. */
export interface RuleTable {
  title: string;
  source: string;
  columns: string[];
  rows: string[][];
}

/** A passive score or special sense, split into a label and its value. */
export interface SenseEntry {
  label: string;
  /** The displayable value, e.g. "14" or "60 ft.". */
  value: string;
}

/** A defensive trait: a main label plus an optional leading qualifier. */
export interface DefenceEntry {
  /** The main label, e.g. a save's restriction or "Fire Resistance". */
  text: string;
  /** A short qualifier shown in parentheses before the text, e.g. "Advantage". */
  qualifier?: string;
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
  defences: DefenceEntry[];
  /** Passive skill scores and special senses (darkvision, etc.). */
  senses: SenseEntry[];
  /** The 18 skills in canonical order. */
  skills: Skill[];
  /** Language and training proficiencies. */
  proficiencies: CharacterProficiencies;
  /** Weapon and weapon-like attacks. */
  attacks: Attack[];
  /** Attacks and other actions. */
  actions: CharacterAction[];
  /** Known/prepared spells. */
  spells: SpellEntry[];
  /** Spellcasting stats (modifier, attack, save DC, slots); absent for non-casters. */
  spellcasting?: Spellcasting;
  /** Companion/summon stat blocks granted by character features. */
  companions: CompanionEntry[];
  /** Rollable rules tables used by character features. */
  ruleTables: RuleTable[];
  /** Carried items. */
  inventory: InventoryEntry[];
  /** Coins held. */
  wealth: Coins;
  /** Features and traits, grouped by source. */
  features: FeatureGroup[];
  sections: CharacterSection[];
}
