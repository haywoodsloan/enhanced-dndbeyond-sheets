import {
  ABILITIES,
  abilityModifier,
  armorClass,
  conditionName,
  maxHitPoints,
  proficiencyBonus,
  type AbilityKey,
  type ArmorCategory,
} from '@/utils/dnd5e';
import type {
  RawCharacter,
  RawModifier,
  RawSourceMap,
  RawStat,
} from './api-types';
import type {
  AbilityScore,
  Character,
  CharacterBasics,
  CharacterClassSummary,
  CharacterSection,
  SectionKey,
} from './model';

/** Fixed counts: 6 saving throws and 18 skills in 5e. */
const SAVE_COUNT = 6;
const SKILL_COUNT = 18;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Sum the lengths of every array in a source-grouped map. */
function sumSourceMap<T>(map: RawSourceMap<T> | null | undefined): number {
  if (!map) return 0;
  return Object.values(map).reduce<number>(
    (total, entries) => total + asArray(entries).length,
    0,
  );
}

/** Known/prepared class spells plus spells granted by race, items, feats, etc. */
function countSpells(raw: RawCharacter): number {
  const classSpells = asArray(raw.classSpells).reduce(
    (total, group) => total + asArray(group.spells).length,
    0,
  );
  return classSpells + sumSourceMap(raw.spells);
}

/** Weapon attacks plus every action (reactions, bonus actions, limited-use…). */
function countActions(raw: RawCharacter): number {
  const weaponAttacks = asArray(raw.inventory).filter(
    (item) => item.displayAsAttack === true,
  ).length;
  return weaponAttacks + sumSourceMap(raw.actions);
}

/** Class features, racial traits, feats, and optional class features. */
function countFeatures(raw: RawCharacter): number {
  const classFeatures = asArray(raw.classes).reduce(
    (total, cls) => total + asArray(cls.classFeatures).length,
    0,
  );
  const racialTraits = asArray(raw.race?.racialTraits).length;
  const feats = asArray(raw.feats).length;
  const optional = asArray(raw.optionalClassFeatures).length;
  return classFeatures + racialTraits + feats + optional;
}

/** Tool/weapon/armor/language proficiencies granted by modifiers. */
function countProficiencies(raw: RawCharacter): number {
  if (!raw.modifiers) return 0;
  return Object.values(raw.modifiers).reduce<number>(
    (total, mods) =>
      total +
      asArray<RawModifier>(mods).filter(
        (mod) => mod.type === 'proficiency' || mod.type === 'language',
      ).length,
    0,
  );
}

/** True when the character carries any coins. */
function hasWealth(raw: RawCharacter): boolean {
  const coins = raw.currencies;
  if (!coins) return false;
  return (
    (coins.cp ?? 0) + (coins.sp ?? 0) + (coins.ep ?? 0) + (coins.gp ?? 0) + (coins.pp ?? 0) >
    0
  );
}

/** Look up a stat's value by its DDB id (1..6), or null when unset. */
function statValue(stats: RawStat[] | undefined, id: number): number | null {
  const entry = asArray(stats).find((stat) => stat.id === id);
  return entry?.value ?? null;
}

/** Sum flat `bonus` modifiers of a given subtype from the top-level map. */
function sumBonusModifiers(raw: RawCharacter, subType: string): number {
  if (!raw.modifiers) return 0;
  return Object.values(raw.modifiers).reduce<number>(
    (total, mods) =>
      total +
      asArray<RawModifier>(mods)
        .filter((mod) => mod.type === 'bonus' && mod.subType === subType)
        .reduce((sum, mod) => sum + (mod.value ?? mod.fixedValue ?? 0), 0),
    0,
  );
}

/** Sum ability-score bonus modifiers for one ability (e.g. "strength-score"). */
function abilityScoreBonus(raw: RawCharacter, abilityName: string): number {
  return sumBonusModifiers(raw, `${abilityName.toLowerCase()}-score`);
}

/**
 * Resolve the six final ability scores: base stat + manual bonus + granted
 * ability-score bonuses, unless an explicit override is set. The modifier is
 * derived from the resolved score.
 */
function resolveAbilities(raw: RawCharacter): AbilityScore[] {
  return ABILITIES.map((meta) => {
    const override = statValue(raw.overrideStats, meta.id);
    const score =
      override != null
        ? override
        : (statValue(raw.stats, meta.id) ?? 10) +
          (statValue(raw.bonusStats, meta.id) ?? 0) +
          abilityScoreBonus(raw, meta.name);
    return {
      key: meta.key,
      name: meta.name,
      score,
      modifier: abilityModifier(score),
    };
  });
}

/** Broad armor category by DDB `armorTypeId` (1 light, 2 medium, 3 heavy). */
const ARMOR_CATEGORY: Record<number, ArmorCategory> = {
  1: 'light',
  2: 'medium',
  3: 'heavy',
};

/** Armor Class from equipped armor and shield, plus flat AC-bonus modifiers. */
function resolveArmorClass(raw: RawCharacter, dexModifier: number): number {
  const worn = asArray(raw.inventory).filter(
    (item) => item.equipped === true && item.definition?.filterType === 'Armor',
  );
  const shield = worn.find((item) => item.definition?.armorTypeId === 4);
  const armor = worn.find((item) => {
    const id = item.definition?.armorTypeId;
    return id === 1 || id === 2 || id === 3;
  });
  return armorClass({
    category: ARMOR_CATEGORY[armor?.definition?.armorTypeId ?? 0] ?? 'none',
    armorBase: armor?.definition?.armorClass ?? 0,
    dexModifier,
    shieldBonus: shield?.definition?.armorClass ?? 0,
    bonus: sumBonusModifiers(raw, 'armor-class'),
  });
}

/** Map active condition entries to their names, dropping any unknown ids. */
function resolveConditions(raw: RawCharacter): string[] {
  return asArray(raw.conditions)
    .map((condition) => conditionName(condition.id))
    .filter((name): name is string => name != null);
}

/** Combat and vital stats for the Basics section. */
function resolveBasics(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): CharacterBasics {
  const modifierOf = (key: AbilityKey) =>
    abilities.find((ability) => ability.key === key)?.modifier ?? 0;
  const dexModifier = modifierOf('dex');
  const max = maxHitPoints({
    base: raw.baseHitPoints ?? 0,
    conModifier: modifierOf('con'),
    level,
    bonus: raw.bonusHitPoints ?? 0,
    override: raw.overrideHitPoints,
  });
  return {
    armorClass: resolveArmorClass(raw, dexModifier),
    initiative: dexModifier + sumBonusModifiers(raw, 'initiative'),
    speed: raw.race?.weightSpeeds?.normal?.walk ?? 30,
    proficiencyBonus: proficiencyBonus(level),
    hitPoints: {
      current: max - (raw.removedHitPoints ?? 0),
      max,
      temp: raw.temporaryHitPoints ?? 0,
    },
    conditions: resolveConditions(raw),
  };
}

function summarizeClasses(raw: RawCharacter): CharacterClassSummary[] {
  return asArray(raw.classes).map((cls) => {
    const summary: CharacterClassSummary = {
      name: cls.definition?.name ?? 'Unknown',
      level: cls.level ?? 0,
    };
    if (cls.subclassDefinition?.name) {
      summary.subclass = cls.subclassDefinition.name;
    }
    return summary;
  });
}

function toSection(
  key: SectionKey,
  title: string,
  count: number,
  options: { alwaysPresent?: boolean } = {},
): CharacterSection {
  return {
    key,
    title,
    count,
    isEmpty: options.alwaysPresent ? false : count === 0,
  };
}

/**
 * Convert a raw D&D Beyond character payload into the internal `Character`
 * model. Section counts reflect presence of content; exact per-entry rendering
 * is handled in a later phase. The core stat sections (basics, attributes,
 * skills, saves) are always shown; the rest auto-hide when empty.
 */
export function normalizeCharacter(raw: RawCharacter): Character {
  const classes = summarizeClasses(raw);
  const level = classes.reduce((total, cls) => total + cls.level, 0);

  const sections: CharacterSection[] = [
    toSection('basics', 'Basics', asArray(raw.conditions).length, { alwaysPresent: true }),
    toSection('attributes', 'Attributes', asArray(raw.stats).length, { alwaysPresent: true }),
    toSection('skills', 'Skills', SKILL_COUNT, { alwaysPresent: true }),
    toSection('savingThrows', 'Saves & Defences', SAVE_COUNT, { alwaysPresent: true }),
    toSection('proficiencies', 'Proficiencies', countProficiencies(raw)),
    toSection('actions', 'Actions', countActions(raw)),
    toSection('spells', 'Spells', countSpells(raw)),
    toSection('inventory', 'Inventory', asArray(raw.inventory).length),
    toSection('wealth', 'Wealth', 0, { alwaysPresent: hasWealth(raw) }),
    toSection('features', 'Features & Traits', countFeatures(raw)),
  ];

  const abilities = resolveAbilities(raw);

  const character: Character = {
    id: raw.id,
    name: raw.name,
    classes,
    level,
    abilities,
    basics: resolveBasics(raw, abilities, level),
    sections,
  };

  const race = raw.race?.fullName ?? raw.race?.baseRaceName;
  if (race) character.race = race;

  const background = raw.background?.definition?.name;
  if (background) character.background = background;

  return character;
}
