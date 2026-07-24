import {
  ABILITIES,
  DAMAGE_TYPES,
  SKILLS,
  abilityKeyById,
  abilityModifier,
  armorClass,
  cantripDiceMultiplier,
  conditionName,
  damageTypeName,
  maxHitPoints,
  proficiencyBonus,
  proficiencyContribution,
  spellSlotsForCasterLevel,
  type AbilityKey,
  type AbilityMeta,
  type ArmorCategory,
  type ProficiencyLevel,
} from '@/utils/character/dnd5e';
import type {
  RawAction,
  RawCharacter,
  RawCreature,
  RawCustomAction,
  RawFeat,
  RawInventoryItem,
  RawLevelScale,
  RawLimitedUse,
  RawModifier,
  RawSpell,
  RawSpellDefinition,
  RawStat,
} from './api-types';
import type {
  AbilityScore,
  ActionCategory,
  AlternateRecovery,
  Attack,
  Character,
  CharacterAction,
  CharacterBasics,
  CharacterClassSummary,
  CompanionEntry,
  CharacterProficiencies,
  CharacterSection,
  Coins,
  DamageInfo,
  DefenceEntry,
  FeatureGroup,
  FeatureItem,
  FeaturePart,
  InventoryEntry,
  ResourcePool,
  RuleTable,
  SavingThrow,
  SectionKey,
  SenseEntry,
  Skill,
  SpellEntry,
  Spellcasting,
  StructuredList,
  WeaponProperty,
} from './model';
import { sectionLabel } from '@/utils/character/section-label';

/** Fixed counts: 6 saving throws and 18 skills in 5e. */
const SAVE_COUNT = 6;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The character's portrait URL, upscaled from the small default avatar and
 * forced to `fit=bounds` so the full image shows instead of a cropped square.
 */
function resolveAvatarUrl(raw: RawCharacter): string | undefined {
  const url = raw.decorations?.avatarUrl;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return undefined;
    if (parsed.searchParams.has('fit')) parsed.searchParams.set('fit', 'bounds');
    if (parsed.searchParams.has('width')) parsed.searchParams.set('width', '400');
    if (parsed.searchParams.has('height')) parsed.searchParams.set('height', '400');
    return parsed.toString();
  } catch {
    return undefined;
  }
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
        .filter(
          (mod) =>
            mod.type === 'bonus' &&
            mod.subType === subType &&
            !mod.restriction?.trim(),
        )
        .reduce((sum, mod) => sum + (mod.value ?? mod.fixedValue ?? 0), 0),
    0,
  );
}

/** Sum ability-score bonus modifiers for one ability (e.g. "strength-score"). */
function abilityScoreBonus(raw: RawCharacter, abilityName: string): number {
  return sumBonusModifiers(raw, `${abilityName.toLowerCase()}-score`);
}

/** Highest unrestricted score setter (e.g. Belt of Giant Strength), if any. */
function abilityScoreSet(raw: RawCharacter, abilityName: string): number | undefined {
  const values = Object.values(raw.modifiers ?? {}).flatMap((modifiers) =>
    asArray<RawModifier>(modifiers).flatMap((mod) =>
      mod.type === 'set' &&
      mod.subType === `${abilityName.toLowerCase()}-score` &&
      !mod.restriction?.trim() &&
      (mod.value ?? mod.fixedValue) != null
        ? [mod.value ?? mod.fixedValue!]
        : [],
    ),
  );
  return values.length ? Math.max(...values) : undefined;
}

/**
 * Resolve the six final ability scores: base stat + manual bonus + granted
 * ability-score bonuses, unless an explicit override is set. The modifier is
 * derived from the resolved score.
 */
function resolveAbilities(raw: RawCharacter): AbilityScore[] {
  return ABILITIES.map((meta) => {
    const override = statValue(raw.overrideStats, meta.id);
    const natural =
      (statValue(raw.stats, meta.id) ?? 10) +
      (statValue(raw.bonusStats, meta.id) ?? 0) +
      abilityScoreBonus(raw, meta.name);
    const set = abilityScoreSet(raw, meta.name);
    const score = override != null ? override : Math.max(natural, set ?? natural);
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

/** Best extra ability/flat bonus supplied by an active unarmored AC formula. */
function unarmoredArmorBonus(
  raw: RawCharacter,
  abilities: AbilityScore[],
  hasShield: boolean,
): number {
  let formulaBonus = 0;
  let flatBonus = 0;
  for (const mods of Object.values(raw.modifiers ?? {})) {
    for (const mod of asArray<RawModifier>(mods)) {
      if (mod.subType !== 'unarmored-armor-class') continue;
      if (hasShield && /shield/i.test(mod.restriction ?? '')) continue;
      if (mod.type === 'set') {
        const key = abilityKeyById(mod.statId);
        const abilityMod = abilities.find((ability) => ability.key === key)?.modifier ?? 0;
        const fixed = mod.value ?? mod.fixedValue ?? 0;
        formulaBonus = Math.max(formulaBonus, abilityMod + fixed);
      } else if (mod.type === 'bonus') {
        flatBonus += mod.value ?? mod.fixedValue ?? 0;
      }
    }
  }
  return formulaBonus + flatBonus;
}

/** Armor Class from equipped armor and shield, plus active AC modifiers. */
function resolveArmorClass(raw: RawCharacter, abilities: AbilityScore[]): number {
  const override = asArray(raw.characterValues).find(
    (entry) => entry.typeId === 1 && Number.isFinite(Number(entry.value)),
  );
  if (override) return Number(override.value);
  const dexModifier = abilities.find((ability) => ability.key === 'dex')?.modifier ?? 0;
  const worn = asArray(raw.inventory).filter(
    (item) => item.equipped === true && item.definition?.filterType === 'Armor',
  );
  const shield = worn.find((item) => item.definition?.armorTypeId === 4);
  const armor = worn.find((item) => {
    const id = item.definition?.armorTypeId;
    return id === 1 || id === 2 || id === 3;
  });
  const mediumDexCaps = Object.values(raw.modifiers ?? {}).flatMap((modifiers) =>
    asArray<RawModifier>(modifiers).flatMap((mod) =>
      mod.type === 'set' &&
      (mod.subType === 'ac-max-dex-armored-modifier' || mod.subType === 'ac-max-dex-modifier') &&
      !mod.restriction?.trim() &&
      (mod.value ?? mod.fixedValue) != null
        ? [mod.value ?? mod.fixedValue!]
        : [],
    ),
  );
  return armorClass({
    category: ARMOR_CATEGORY[armor?.definition?.armorTypeId ?? 0] ?? 'none',
    armorBase: armor?.definition?.armorClass ?? 0,
    dexModifier,
    shieldBonus: shield?.definition?.armorClass ?? 0,
    bonus:
      sumBonusModifiers(raw, 'armor-class') +
      (armor ? sumBonusModifiers(raw, 'armored-armor-class') : 0),
    unarmoredBonus: armor ? 0 : unarmoredArmorBonus(raw, abilities, Boolean(shield)),
    mediumDexCap: mediumDexCaps.length ? Math.max(2, ...mediumDexCaps) : 2,
  });
}

/** Flat max-HP bonuses, including bonuses that scale by character/class level. */
function maxHitPointBonus(raw: RawCharacter, level: number): number {
  let bonus = raw.bonusHitPoints ?? 0;
  const classLevels = classLevelsByComponent(raw);
  for (const mods of Object.values(raw.modifiers ?? {})) {
    for (const mod of asArray<RawModifier>(mods)) {
      if (mod.type !== 'bonus' || mod.subType !== 'hit-points-per-level') continue;
      const perLevel = mod.value ?? mod.fixedValue ?? 0;
      const applicableLevels =
        mod.componentId == null ? level : (classLevels.get(mod.componentId) ?? level);
      bonus += perLevel * applicableLevels;
    }
  }
  return bonus;
}

/** Map active condition entries to their names, dropping any unknown ids. */
function resolveConditions(raw: RawCharacter): string[] {
  return asArray(raw.conditions)
    .map((condition) => conditionName(condition.id))
    .filter((name): name is string => name != null);
}

function resolveConditionLevels(raw: RawCharacter): Record<string, number> | undefined {
  const levels: Record<string, number> = {};
  for (const condition of asArray(raw.conditions)) {
    const name = conditionName(condition.id);
    const level = condition.level ?? 0;
    if (name && level > 0) levels[name] = level;
  }
  return Object.keys(levels).length ? levels : undefined;
}

type MovementSpeed = 'walk' | 'burrow' | 'climb' | 'fly' | 'swim';

const CUSTOM_MOVEMENT_TYPES: Readonly<Record<number, MovementSpeed>> = {
  1: 'walk',
  2: 'burrow',
  3: 'climb',
  4: 'fly',
  5: 'swim',
};

const CREATURE_SIZES: Readonly<Record<number, string>> = {
  2: 'Tiny',
  3: 'Small',
  4: 'Medium',
  5: 'Large',
  6: 'Huge',
  7: 'Gargantuan',
  10: 'Medium or Small',
};

const CREATURE_TYPES: Readonly<Record<number, string>> = {
  1: 'Aberration',
  2: 'Beast',
  3: 'Celestial',
  4: 'Construct',
  6: 'Dragon',
  7: 'Elemental',
  8: 'Fey',
  9: 'Fiend',
  10: 'Giant',
  11: 'Humanoid',
  13: 'Monstrosity',
  14: 'Ooze',
  15: 'Plant',
  16: 'Undead',
};

function resolveCreatureSize(raw: RawCharacter): string | undefined {
  const explicit = raw.race?.size?.trim();
  if (explicit) return explicit;
  if (raw.race?.sizeId === 10) {
    const choice = asArray(raw.choices?.race).find((entry) =>
      /\bsize\b/i.test(entry.label ?? ''),
    );
    if (choice?.optionValue != null) {
      const selected = asArray(raw.choices?.choiceDefinitions)
        .flatMap((definition) => asArray(definition.options))
        .find((option) => option.id === choice.optionValue)
        ?.label?.trim();
      if (selected) return selected;
    }
  }
  return raw.race?.sizeId == null ? undefined : CREATURE_SIZES[raw.race.sizeId];
}

function resolveMovementSpeeds(raw: RawCharacter): Record<MovementSpeed, number> {
  const normal = raw.race?.weightSpeeds?.normal;
  const speeds: Record<MovementSpeed, number> = {
    walk: normal?.walk ?? 30,
    burrow: normal?.burrow ?? 0,
    climb: normal?.climb ?? 0,
    fly: normal?.fly ?? 0,
    swim: normal?.swim ?? 0,
  };
  for (const custom of asArray(raw.customSpeeds)) {
    const movement = CUSTOM_MOVEMENT_TYPES[custom.movementId ?? 0];
    if (movement && custom.distance != null && custom.distance > 0) {
      speeds[movement] = custom.distance;
    }
  }
  return speeds;
}

/** Combat and vital stats for the Basics section. */
function resolveBasics(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): CharacterBasics {
  const modifierOf = (key: AbilityKey) =>
    abilities.find((ability) => ability.key === key)?.modifier ?? 0;
  const max = maxHitPoints({
    base: raw.baseHitPoints ?? 0,
    conModifier: modifierOf('con'),
    level,
    bonus: maxHitPointBonus(raw, level),
    override: raw.overrideHitPoints,
  });
  // Group each class's levels by its hit-die size so a multiclass character shows
  // e.g. "2d8 + 3d10"; highest die first.
  const hitDiceByDie = new Map<number, number>();
  for (const cls of asArray(raw.classes)) {
    const die = cls.definition?.hitDice ?? 0;
    if (die > 0) hitDiceByDie.set(die, (hitDiceByDie.get(die) ?? 0) + (cls.level ?? 0));
  }
  const hitDice = [...hitDiceByDie]
    .map(([die, count]) => ({ die, count }))
    .sort((a, b) => b.die - a.die);
  const speeds = resolveMovementSpeeds(raw);
  const specialSpeeds = (
    [
      ['Fly', speeds.fly],
      ['Swim', speeds.swim],
      ['Climb', speeds.climb],
      ['Burrow', speeds.burrow],
    ] as const
  ).flatMap(([label, value]) => (value && value > 0 ? [{ label, value }] : []));
  const conditionLevels = resolveConditionLevels(raw);
  return {
    armorClass: resolveArmorClass(raw, abilities),
    initiative: modifierOf('dex') + sumBonusModifiers(raw, 'initiative'),
    speed: speeds.walk,
    ...(specialSpeeds.length ? { specialSpeeds } : {}),
    proficiencyBonus: proficiencyBonus(level),
    hitPoints: {
      current: max - (raw.removedHitPoints ?? 0),
      max,
      temp: raw.temporaryHitPoints ?? 0,
    },
    hitDice,
    inspiration: raw.inspiration ?? false,
    conditions: resolveConditions(raw),
    ...(conditionLevels ? { conditionLevels } : {}),
  };
}

/** True when any top-level modifier matches the given type and subtype. */
function hasModifier(raw: RawCharacter, type: string, subType: string): boolean {
  if (!raw.modifiers) return false;
  return Object.values(raw.modifiers).some((mods) =>
    asArray<RawModifier>(mods).some(
      (mod) => mod.type === type && mod.subType === subType,
    ),
  );
}

/** True when the character is proficient in a save, honoring a user override. */
function hasSaveProficiency(
  raw: RawCharacter,
  abilityName: string,
  abilityId: number,
): boolean {
  const custom = asArray(raw.characterValues).find(
    (entry) => entry.typeId === 41 && Number(entry.valueId) === abilityId,
  );
  if (custom) return Number(custom.value) !== 1;
  return hasModifier(raw, 'proficiency', `${abilityName.toLowerCase()}-saving-throws`);
}

function customSaveBonus(raw: RawCharacter, abilityId: number): number {
  return asArray(raw.characterValues)
    .filter(
      (entry) =>
        (entry.typeId === 39 || entry.typeId === 40) &&
        Number(entry.valueId) === abilityId,
    )
    .reduce((total, entry) => total + (Number(entry.value) || 0), 0);
}

/** The six saving throws: ability modifier + proficiency (if trained) + bonuses. */
function resolveSavingThrows(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): SavingThrow[] {
  const prof = proficiencyBonus(level);
  return ABILITIES.map((meta) => {
    const abilityMod =
      abilities.find((ability) => ability.key === meta.key)?.modifier ?? 0;
    const proficient = hasSaveProficiency(raw, meta.name, meta.id);
    const bonus =
      sumBonusModifiers(raw, 'saving-throws') +
      sumBonusModifiers(raw, `${meta.name.toLowerCase()}-saving-throws`) +
      customSaveBonus(raw, meta.id);
    return {
      key: meta.key,
      name: meta.name,
      modifier: abilityMod + (proficient ? prof : 0) + bonus,
      proficient,
    };
  });
}

/** Add a value to a list only if it is not already present. */
function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/** Highest proficiency level the character has in a skill, honoring a user override. */
function skillProficiency(
  raw: RawCharacter,
  skillKey: string,
  valueId: number,
): ProficiencyLevel {
  const custom = asArray(raw.characterValues).find(
    (entry) => entry.typeId === 26 && Number(entry.valueId) === valueId,
  );
  if (custom) {
    const levels: Record<number, ProficiencyLevel> = {
      1: 'none',
      2: 'half',
      3: 'proficient',
      4: 'expertise',
    };
    const level = levels[Number(custom.value)];
    if (level) return level;
  }
  if (hasModifier(raw, 'expertise', skillKey)) return 'expertise';
  if (hasModifier(raw, 'proficiency', skillKey)) return 'proficient';
  if (hasModifier(raw, 'half-proficiency', skillKey)) return 'half';
  return 'none';
}

function customSkillAbility(
  raw: RawCharacter,
  valueId: number,
  fallback: AbilityKey,
): AbilityKey {
  const custom = asArray(raw.characterValues).find(
    (entry) => entry.typeId === 27 && Number(entry.valueId) === valueId,
  );
  return abilityKeyById(custom ? Number(custom.value) : undefined) ?? fallback;
}

function customSkillBonus(raw: RawCharacter, valueId: number): number {
  return asArray(raw.characterValues)
    .filter(
      (entry) =>
        (entry.typeId === 24 || entry.typeId === 25) &&
        Number(entry.valueId) === valueId,
    )
    .reduce((total, entry) => total + (Number(entry.value) || 0), 0);
}

/** Rules text keyed by the active feature/option id that owns a modifier. */
function modifierSourceTextById(raw: RawCharacter): Map<number, string> {
  const textById = new Map<number, string>();
  const add = (
    definition:
      | { id?: number; description?: string | null; snippet?: string | null }
      | null
      | undefined,
  ) => {
    if (definition?.id == null) return;
    const text = definition.description || definition.snippet;
    if (text) textById.set(definition.id, text);
  };
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) add(feature);
    for (const feature of asArray(cls.classFeatures)) add(feature.definition);
  }
  for (const trait of asArray(raw.race?.racialTraits)) add(trait.definition);
  for (const feat of asArray(raw.feats)) add(feat.definition);
  if (raw.options) {
    const groups = [raw.options.race, raw.options.class, raw.options.feat, raw.options.background, raw.options.item];
    for (const group of groups) {
      for (const option of asArray(group)) add(option.definition);
    }
  }
  return textById;
}

/** Always-on numeric bonus represented by one D&D Beyond modifier. A `statId`
 * means use that ability's modifier; any explicit minimum is read from the
 * owning feature text because the modifier record does not carry it. */
function resolvedBonusModifier(
  mod: RawModifier,
  modifierByKey: Map<AbilityKey, number>,
  sourceTextById: Map<number, string>,
): number {
  const fixed = mod.value ?? mod.fixedValue;
  if (fixed != null) return fixed;
  const key = abilityKeyById(mod.statId);
  if (!key) return 0;
  let value = modifierByKey.get(key) ?? 0;
  const source = mod.componentId == null ? '' : plainText(sourceTextById.get(mod.componentId) ?? '');
  const minimum = /\bminimum(?:\s+bonus)?(?:\s+of)?\s*\+?(\d+)\b/i.exec(source)?.[1];
  if (minimum) value = Math.max(value, Number(minimum));
  return value;
}

function skillBonuses(
  raw: RawCharacter,
  skillKey: string,
  ability: AbilityKey,
  modifierByKey: Map<AbilityKey, number>,
  sourceTextById: Map<number, string>,
): number {
  if (!raw.modifiers) return 0;
  const abilityName = ABILITIES.find((entry) => entry.key === ability)?.name.toLowerCase();
  const subTypes = new Set([
    skillKey,
    'ability-checks',
    ...(abilityName ? [`${abilityName}-ability-checks`] : []),
  ]);
  let total = 0;
  for (const mods of Object.values(raw.modifiers)) {
    for (const mod of asArray<RawModifier>(mods)) {
      if (
        mod.type !== 'bonus' ||
        !subTypes.has(mod.subType ?? '') ||
        mod.restriction?.trim()
      ) {
        continue;
      }
      total += resolvedBonusModifier(mod, modifierByKey, sourceTextById);
    }
  }
  return total;
}

/** The 18 skills: ability modifier + proficiency + always-on feature bonuses. */
function resolveSkills(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): Skill[] {
  const prof = proficiencyBonus(level);
  const modifierByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  const sourceTextById = modifierSourceTextById(raw);
  const standard = SKILLS.map((meta) => {
    const ability = customSkillAbility(raw, meta.valueId, meta.ability);
    const proficiency = skillProficiency(raw, meta.key, meta.valueId);
    const abilityMod = modifierByKey.get(ability) ?? 0;
    return {
      key: meta.key,
      name: meta.name,
      ability,
      proficiency,
      modifier:
        abilityMod +
        proficiencyContribution(proficiency, prof) +
        skillBonuses(raw, meta.key, ability, modifierByKey, sourceTextById) +
        customSkillBonus(raw, meta.valueId),
    };
  });
  const levels: Record<number, ProficiencyLevel> = {
    1: 'none',
    2: 'half',
    3: 'proficient',
    4: 'expertise',
  };
  const custom = asArray(raw.customProficiencies).flatMap((entry, index) => {
    if (entry.type !== 1 || !entry.name?.trim()) return [];
    const ability = abilityKeyById(entry.statId) ?? 'dex';
    const proficiency = levels[entry.proficiencyLevel ?? 1] ?? 'none';
    const bonus = (Number(entry.miscBonus) || 0) + (Number(entry.magicBonus) || 0);
    return [{
      key: `custom-${index}-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: entry.name.trim(),
      ability,
      proficiency,
      modifier:
        (modifierByKey.get(ability) ?? 0) +
        proficiencyContribution(proficiency, prof) +
        bonus,
    }];
  });
  return [...standard, ...custom];
}

/** Languages plus armor/weapon/tool training, from the modifier map. */
function resolveProficiencies(raw: RawCharacter): CharacterProficiencies {
  const languages: string[] = [];
  const armor: string[] = [];
  const weapons: string[] = [];
  const tools: string[] = [];
  const skillKeys = new Set(SKILLS.map((skill) => skill.key));

  if (raw.modifiers) {
    for (const mods of Object.values(raw.modifiers)) {
      for (const mod of asArray<RawModifier>(mods)) {
        const label = mod.friendlySubtypeName?.trim();
        if (!label || /^choose\b/i.test(label)) continue;
        if (mod.type === 'language') {
          pushUnique(languages, label);
        } else if (mod.type === 'proficiency') {
          const sub = mod.subType ?? '';
          if (sub.endsWith('-saving-throws') || skillKeys.has(sub)) continue;
          if (sub.includes('armor') || sub === 'shields') pushUnique(armor, label);
          else if (sub.includes('weapon')) pushUnique(weapons, label);
          else pushUnique(tools, label);
        }
      }
    }
  }

  for (const custom of asArray(raw.customProficiencies)) {
    const name = custom.name?.trim();
    if (!name) continue;
    if (custom.type === 2) pushUnique(tools, name);
    else if (custom.type === 3) pushUnique(languages, name);
  }

  return { languages, armor, weapons, tools };
}

/** Map a D&D Beyond `activationType` to an action category. */
function actionCategory(activationType: number | null | undefined): ActionCategory {
  switch (activationType) {
    case 1:
      return 'action';
    case 3:
      return 'bonus';
    case 4:
      return 'reaction';
    default:
      return 'other';
  }
}

/** D&D Beyond weapon `attackType`: 2 = ranged (1 = melee). */
const RANGED_WEAPON = 2;

type WeaponDef = NonNullable<RawInventoryItem['definition']>;

/** Flat magic to-hit / damage bonus granted by a weapon's own modifiers. */
function weaponMagicBonus(def: WeaponDef): number {
  return asArray(def.grantedModifiers)
    .filter((mod) => mod.type === 'bonus')
    .reduce((sum, mod) => sum + (mod.fixedValue ?? mod.value ?? 0), 0);
}

/** Always-on attack-roll bonuses that apply to this weapon's attack mode. */
function weaponAttackBonus(raw: RawCharacter, def: WeaponDef): number {
  const mode = def.attackType === RANGED_WEAPON ? 'ranged' : 'melee';
  const subTypes = new Set([
    'weapon-attacks',
    `${mode}-attacks`,
    `${mode}-weapon-attacks`,
  ]);
  let total = 0;
  for (const modifiers of Object.values(raw.modifiers ?? {})) {
    for (const mod of asArray<RawModifier>(modifiers)) {
      if (
        mod.type === 'bonus' &&
        subTypes.has(mod.subType ?? '') &&
        !mod.restriction?.trim()
      ) {
        total += mod.value ?? mod.fixedValue ?? 0;
      }
    }
  }
  return total;
}

/** Whether the character is proficient with a weapon (specific or by category). */
function isWeaponProficient(raw: RawCharacter, def: WeaponDef): boolean {
  const slug = (def.name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug && hasModifier(raw, 'proficiency', slug)) return true;
  if (def.categoryId === 2) return hasModifier(raw, 'proficiency', 'martial-weapons');
  return hasModifier(raw, 'proficiency', 'simple-weapons');
}

/**
 * Plain text from a D&D Beyond rules string: strips HTML tags, the `[tag]…`
 * markup D&D Beyond wraps around cross-references, and its `{{…}}` dynamic-value
 * placeholders (which we can't resolve here), decodes HTML entities (named smart
 * quotes/dashes plus any numeric `&#…;`), and collapses whitespace. Whole HTML
 * tables are dropped first: the printed sheet has no room for them and their
 * cells would otherwise flatten into unreadable run-on text.
 */
function plainText(html: string): string {
  return html
    .replace(/<table[\s\S]*?<\/table>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[\/?[^\]]+\]/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&(?:quot|ldquo|rdquo);/g, '"')
    .replace(/&(?:#39|apos|lsquo|rsquo);/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&minus;/g, '−')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (match, code: string) => {
      const point = Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => {
      const point = parseInt(hex, 16);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Like `plainText` but preserves bold HEADINGS as `**…**` markers so a list-
 * formatted description keeps them (e.g. the Command spell's suggested commands
 * “Approach.”, “Drop.”, …). D&D Beyond wraps a heading in `<strong>` or
 * `<strong><em>…</em></strong>`; everything else is stripped like plainText.
 */
function richText(html: string): string {
  return plainText(
    html
      .replace(/<(?:strong|b)>\s*<(?:em|i)>/gi, '**')
      .replace(/<\/(?:em|i)>\s*<\/(?:strong|b)>/gi, '**')
      .replace(/<\/?(?:strong|b)>/gi, '**'),
  );
}

/**
 * A short blurb from a rules string — enough to actually use the ability, not
 * the full rules dump. Returns the whole text when it's already short (a curated
 * snippet), else keeps as many WHOLE sentences as fit `maxLength` (preferring a
 * real sentence end — a ./!/? before a capital or the end — so mid-sentence
 * abbreviations like "ft." don't cut it short), else a word-boundary cut.
 * List-formatted rules (two or more bold `**headings**`, e.g. the Command
 * spell's suggested commands) keep the whole list — truncating to the first
 * item would drop the other options — up to a generous cap.
 */
function summarize(
  text: string | null | undefined,
  maxLength = 400,
  resolvePlaceholders?: (text: string) => string,
): string {
  const source = text ?? '';
  const plain = richText(resolvePlaceholders ? resolvePlaceholders(source) : source);
  const isList = (plain.match(/\*\*[^*]+\*\*/g) ?? []).length >= 2;
  const cap = isList ? Math.max(maxLength, 1200) : maxLength;
  if (!plain || plain.length <= cap) return plain;
  const slice = plain.slice(0, cap);
  const sentences = slice.match(/^[\s\S]*[.!?](?=\s+\**[A-Z(]|$)/)?.[0];
  if (sentences && sentences.length >= cap * 0.5) return sentences.trimEnd();
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : cap).trimEnd()}…`;
}

/**
 * A resolver for D&D Beyond's `{{…}}` dynamic-value placeholders, bound to this
 * character's level and ability modifiers. Handles the common forms —
 * `{{classlevel}}`, `{{proficiency}}`, `{{modifier:cha}}` (with optional
 * `@min:N` / `#unsigned` flags), `{{savedc:wis}}` (a spell/feature save DC), and
 * arithmetic such as `{{(classlevel/2)@rounddown}}`, `{{2*characterlevel}}`, or
 * `{{speed/2#rounddown}}`. Feature/action context also supplies `scalevalue` and
 * `limiteduse`. Unknown placeholders are dropped. Modifiers render signed unless
 * `#unsigned`; levels, DCs, and arithmetic render plain.
 */
interface PlaceholderContext {
  classLevel?: number;
  castingClass?: string;
  limitedUse?: number;
  scaleValue?: number | string;
}

type PlaceholderResolver = (text: string, context?: PlaceholderContext) => string;

/** Evaluate arithmetic after known D&D Beyond variables have been replaced.
 * This deliberately supports only numbers, parentheses, and + - * / operators. */
function evaluateArithmetic(expression: string): number | undefined {
  const source = expression.replace(/\s+/g, '');
  let index = 0;
  const parseExpression = (): number | undefined => {
    let value = parseTerm();
    if (value == null) return undefined;
    while (source[index] === '+' || source[index] === '-') {
      const operator = source[index++];
      const right = parseTerm();
      if (right == null) return undefined;
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  const parseTerm = (): number | undefined => {
    let value = parseFactor();
    if (value == null) return undefined;
    while (source[index] === '*' || source[index] === '/') {
      const operator = source[index++];
      const right = parseFactor();
      if (right == null || (operator === '/' && right === 0)) return undefined;
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  const parseFactor = (): number | undefined => {
    if (source[index] === '+' || source[index] === '-') {
      const sign = source[index++] === '-' ? -1 : 1;
      const value = parseFactor();
      return value == null ? undefined : sign * value;
    }
    if (source[index] === '(') {
      index += 1;
      const value = parseExpression();
      if (value == null || source[index] !== ')') return undefined;
      index += 1;
      return value;
    }
    const match = /^\d+(?:\.\d+)?/.exec(source.slice(index));
    if (!match) return undefined;
    index += match[0].length;
    return Number(match[0]);
  };
  const value = parseExpression();
  return value != null && index === source.length ? value : undefined;
}

/**
 * D&D Beyond encodes some irregular progressions as a primary class-level
 * division followed by a `max:` threshold expression. The practical meaning is
 * one increase at each listed divisor (for example Divine Spark at levels
 * 7/13/18), rather than repeatedly applying the suffixes to the whole formula.
 */
function evaluateTieredClassLevel(expression: string, classLevel: number): number | undefined {
  const source = expression.replace(/\s+/g, '');
  const match =
    /^(\d+)\+\(classlevel\/(\d+)\)@rounddown,max:\d+\+\(classlevel\/(\d+)\)@rounddown\+\(classlevel\/(\d+)\)@rounddown$/i.exec(
      source,
    );
  if (!match) return undefined;
  const base = Number(match[1]);
  const thresholds = match.slice(2).map(Number);
  return base + thresholds.filter((threshold) => classLevel >= threshold).length;
}

function makePlaceholderResolver(
  abilities: AbilityScore[],
  characterLevel: number,
  speed: number,
  saveDcBonus: (ability: AbilityKey, castingClass?: string) => number = () => 0,
): PlaceholderResolver {
  const modByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  const scoreByKey = new Map(abilities.map((ability) => [ability.key, ability.score]));
  return (text, context = {}) =>
    text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_whole, expr: string) => {
      const [beforeHash, format = ''] = expr.split('#');
      const classLevel = context.classLevel ?? characterLevel;
      const tieredValue = evaluateTieredClassLevel(beforeHash, classLevel);
      const [core, ...flags] = (tieredValue == null ? beforeHash.split('@') : [beforeHash]).map(
        (part) => part.trim(),
      );
      const modMatch = /^modifier:([a-z]+)$/i.exec(core);
      const saveDcMatch = /^savedc:([a-z]+)$/i.exec(core);
      const directScale = /^scalevalue$/i.test(core) ? context.scaleValue : undefined;
      if (typeof directScale === 'string') return directScale;
      let value: number | undefined = tieredValue;
      if (value != null) {
        // The tiered evaluator consumed its embedded rounding/threshold suffixes.
      } else if (/^classlevel$/i.test(core)) {
        value = classLevel;
      } else if (/^characterlevel$/i.test(core)) {
        value = characterLevel;
      } else if (/^proficiency(?:bonus)?$/i.test(core)) {
        value = proficiencyBonus(characterLevel);
      } else if (/^limiteduse$/i.test(core)) {
        value = context.limitedUse;
      } else if (/^scalevalue$/i.test(core)) {
        value = typeof directScale === 'number' ? directScale : undefined;
      } else if (saveDcMatch) {
        // Save DC = 8 + proficiency + the relevant ability's modifier.
        const ability = saveDcMatch[1].slice(0, 3).toLowerCase() as AbilityKey;
        const mod = modByKey.get(ability);
        if (mod != null) {
          value =
            8 +
            proficiencyBonus(characterLevel) +
            mod +
            saveDcBonus(ability, context.castingClass);
        }
      } else if (modMatch) {
        value = modByKey.get(modMatch[1].slice(0, 3).toLowerCase() as AbilityKey);
      } else {
        // Arithmetic on the known character values, e.g. (classlevel/2),
        // 2*characterlevel, speed/2, or 13+proficiency.
        const arith = core
          .replace(/modifier:([a-z]{3})/gi, (_match, ability: string) =>
            String(modByKey.get(ability.toLowerCase() as AbilityKey) ?? 'unknown'),
          )
          .replace(/abilityscore:([a-z]{3})/gi, (_match, ability: string) =>
            String(scoreByKey.get(ability.toLowerCase() as AbilityKey) ?? 'unknown'),
          )
          .replace(/characterlevel/gi, String(characterLevel))
          .replace(/classlevel/gi, String(classLevel))
          .replace(/proficiency(?:bonus)?/gi, String(proficiencyBonus(characterLevel)))
          .replace(/limiteduse/gi, String(context.limitedUse ?? ''))
          .replace(/speed/gi, String(speed));
        value = evaluateArithmetic(arith);
      }
      if (value == null || Number.isNaN(value)) return ''; // unresolved -> drop
      const allFlags = [...flags.flatMap((flag) => flag.split(',')), ...format.split(',')];
      for (const flag of allFlags) {
        const min = /^min:(-?\d+)/.exec(flag);
        const max = /^max:(-?\d+)/.exec(flag);
        if (min) value = Math.max(value, Number(min[1]));
        else if (max) value = Math.min(value, Number(max[1]));
        else if (/rounddown/i.test(flag)) value = Math.floor(value);
        else if (/roundup/i.test(flag)) value = Math.ceil(value);
      }
      value = Math.round(value);
      if (format.split(',').some((flag) => /^signed$/i.test(flag.trim()))) {
        return value >= 0 ? `+${value}` : String(value);
      }
      if (modMatch && !/unsigned/i.test(format)) return value >= 0 ? `+${value}` : String(value);
      return String(value);
    });
}

/** One weapon's attack line: to-hit + damage + range + property notes. */
function weaponAttack(
  raw: RawCharacter,
  def: WeaponDef,
  modOf: (key: AbilityKey) => number,
  prof: number,
): Attack {
  const properties: WeaponProperty[] = asArray(def.properties)
    .map((property) => ({
      name: property.name ?? '',
      ...(property.description ? { description: plainText(property.description) } : {}),
    }))
    .filter((property) => property.name);
  const ranged = def.attackType === RANGED_WEAPON;
  const finesse = properties.some((property) => property.name === 'Finesse');
  // Ranged uses Dex; a Finesse weapon uses the better of Str/Dex; else Str.
  const abilityMod = ranged
    ? modOf('dex')
    : finesse
      ? Math.max(modOf('str'), modOf('dex'))
      : modOf('str');
  const magic = weaponMagicBonus(def);
  const attackBonus = weaponAttackBonus(raw, def);
  const attack: Attack = {
    name: def.name!,
    toHit: abilityMod + (isWeaponProficient(raw, def) ? prof : 0) + magic + attackBonus,
  };
  if (def.damage?.diceString) {
    attack.damage = {
      dice: def.damage.diceString,
      bonus: abilityMod + magic,
      ...(def.damageType ? { type: def.damageType } : {}),
    };
  } else if (def.fixedDamage != null) {
    attack.damage = {
      dice: '',
      bonus: def.fixedDamage + magic,
      ...(def.damageType ? { type: def.damageType } : {}),
    };
  }
  attack.range =
    ranged || properties.some((property) => property.name === 'Thrown')
      ? `${def.range ?? 0}/${def.longRange ?? def.range ?? 0} ft.`
      : `${def.range ?? 5} ft.`;
  if (properties.length) attack.properties = properties;
  return attack;
}

/**
 * Weapon and weapon-like attacks: a base Unarmed Strike plus every equipped (or
 * attack-flagged) weapon, each with a computed to-hit and damage line. Unequipped
 * backpack weapons are left in the Inventory, matching what D&D Beyond surfaces
 * as attacks.
 */
function resolveAttacks(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): Attack[] {
  const prof = proficiencyBonus(level);
  const modByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  const modOf = (key: AbilityKey) => modByKey.get(key) ?? 0;

  const attacks: Attack[] = [];
  // Skip a weapon whose attack line is identical to one already added — two
  // equipped copies of the same weapon would otherwise repeat the row.
  const seen = new Set<string>();
  const signatureOf = (attack: Attack): string =>
    JSON.stringify({
      name: attack.name,
      toHit: attack.toHit ?? null,
      save: attack.save ?? null,
      damage: attack.damage ?? null,
      range: attack.range ?? null,
      properties: (attack.properties ?? []).map((property) => property.name),
    });
  for (const item of asArray(raw.inventory)) {
    const def = item.definition;
    if (!def?.name) continue;
    const isWeapon = def.filterType === 'Weapon';
    const flagged = item.displayAsAttack === true;
    // Include real weapons that are equipped (or explicitly attack-flagged), plus
    // any item D&D Beyond flags as an attack. Unequipped backpack weapons stay in
    // the Inventory, matching what the site surfaces as attacks.
    if (!isWeapon && !flagged) continue;
    if (isWeapon && item.equipped !== true && !flagged) continue;
    const attack = weaponAttack(raw, def, modOf, prof);
    const signature = signatureOf(attack);
    if (seen.has(signature)) continue;
    seen.add(signature);
    attacks.push(attack);
  }
  for (const custom of asArray(raw.customActions)) {
    const attack = customAttack(custom, abilities, level);
    if (!attack) continue;
    const signature = signatureOf(attack);
    if (seen.has(signature)) continue;
    seen.add(signature);
    attacks.push(attack);
  }
  // Every creature can make an Unarmed Strike (2024 rules: 1 + Str bludgeoning),
  // so keep it as an always-available fallback at the end of the list.
  attacks.push({
    name: 'Unarmed Strike',
    toHit: modOf('str') + prof,
    damage: { dice: '', bonus: 1 + modOf('str'), type: 'Bludgeoning' },
    range: '5 ft.',
  });
  return attacks;
}

/** Classes whose base class or selected subclass actually grants spellcasting. */
function castingClasses(raw: RawCharacter) {
  return asArray(raw.classes).filter(
    (cls) => cls.definition?.canCastSpells || cls.subclassDefinition?.canCastSpells,
  );
}

function castingAbilityId(cls: RawCharacter['classes'][number]): number | undefined {
  return (
    cls.subclassDefinition?.spellCastingAbilityId ??
    cls.definition?.spellCastingAbilityId ??
    undefined
  );
}

function castingSource(cls: RawCharacter['classes'][number]): string {
  const className = cls.definition?.name ?? 'Spellcasting';
  return cls.subclassDefinition?.canCastSpells && !cls.definition?.canCastSpells
    ? `${className} (${cls.subclassDefinition.name ?? 'Subclass'})`
    : className;
}

/** Concise focus name from a class's Spellcasting/Pact Magic rules. */
function castingFocus(cls: RawCharacter['classes'][number]): string | undefined {
  const feature = asArray(cls.definition?.classFeatures).find((entry) =>
    /^(?:Spellcasting|Pact Magic)$/.test(entry.name ?? ''),
  );
  const text = plainText(feature?.description ?? feature?.snippet ?? '');
  return /\buse an? (.+?) as (?:a |your )?Spellcasting Focus\b/i.exec(text)?.[1];
}

type CastingBonusKind = 'attack' | 'saveDc';

/** Active bonuses to spell attacks/save DCs, including class-specific forms. */
function castingBonus(
  raw: RawCharacter,
  className: string | undefined,
  kind: CastingBonusKind,
): number {
  const classSlug = className
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const globalSubTypes = kind === 'attack'
    ? new Set(['spell-attacks', 'spell-attack-rolls'])
    : new Set(['spell-save-dc']);
  const classSubTypes = classSlug
    ? kind === 'attack'
      ? new Set([`${classSlug}-spell-attacks`, `${classSlug}-spell-attack-rolls`])
      : new Set([`${classSlug}-spell-save-dc`])
    : new Set<string>();
  let total = 0;
  for (const modifiers of Object.values(raw.modifiers ?? {})) {
    for (const mod of asArray<RawModifier>(modifiers)) {
      if (
        mod.type === 'bonus' &&
        !mod.restriction?.trim() &&
        (globalSubTypes.has(mod.subType ?? '') || classSubTypes.has(mod.subType ?? ''))
      ) {
        total += mod.value ?? mod.fixedValue ?? 0;
      }
    }
  }
  return total;
}

function castingSaveDcBonus(
  raw: RawCharacter,
  ability: AbilityKey,
  className?: string,
): number {
  if (className) return castingBonus(raw, className, 'saveDc');
  const matching = castingClasses(raw).filter(
    (cls) => abilityKeyById(castingAbilityId(cls)) === ability,
  );
  return matching.length
    ? Math.max(...matching.map((cls) => castingBonus(raw, cls.definition?.name, 'saveDc')))
    : castingBonus(raw, undefined, 'saveDc');
}

/** Spell save DC: 8 + proficiency bonus + spellcasting ability modifier. */
function spellSaveDc(raw: RawCharacter, abilities: AbilityScore[], level: number): number {
  const saveDcs = castingClasses(raw).flatMap((cls) => {
    const key = abilityKeyById(castingAbilityId(cls));
    if (!key) return [];
    const mod = abilities.find((ability) => ability.key === key)?.modifier ?? 0;
    return [
      8 +
        proficiencyBonus(level) +
        mod +
        castingBonus(raw, cls.definition?.name, 'saveDc'),
    ];
  });
  return saveDcs.length ? Math.max(...saveDcs) : 8 + proficiencyBonus(level);
}

/** Pact progression migrates a small pool to higher slot levels rather than
 * accumulating lower-level slots. Detect that shape from the published table. */
function hasPactSlotProgression(cls: RawCharacter['classes'][number]): boolean {
  const rows = asArray(cls.definition?.spellRules?.levelSpellSlots);
  return (
    rows.length > 0 &&
    rows.every((row) => row.filter((count) => count > 0).length <= 1) &&
    rows.some((row) => row[0] === 0 && row.slice(1).some((count) => count > 0))
  );
}

function directSlots(cls: RawCharacter['classes'][number]): number[] {
  return [...(cls.definition?.spellRules?.levelSpellSlots?.[cls.level] ?? [])];
}

function trimSlots(slots: number[]): number[] {
  while (slots.length && slots[slots.length - 1] === 0) slots.pop();
  return slots;
}

function combinedCasterLevel(classes: RawCharacter['classes']): number {
  return classes.reduce((total, cls) => {
    const rules = cls.definition?.spellRules;
    const divisor = rules?.multiClassSpellSlotDivisor;
    // Without published progression metadata, treating an unknown/homebrew
    // caster as full would overgrant slots. Keep its spells, but contribute no
    // shared slots until D&D Beyond supplies the divisor.
    if (divisor == null || divisor < 1) return total;
    const rawLevel = cls.level / Math.max(1, divisor);
    const level = rules?.multiClassSpellSlotRounding === 2
      ? Math.ceil(rawLevel)
      : Math.floor(rawLevel);
    return total + level;
  }, 0);
}

/** Spellcasting summary (ability, modifier, attack, save DC, slots), or nothing
 * for a character with no spellcasting ability or slots. */
function resolveSpellcasting(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): Spellcasting | undefined {
  const prof = proficiencyBonus(level);
  const casters = castingClasses(raw);
  const profilesByStats = new Map<
    string,
    {
      sources: string[];
      ability: AbilityKey;
      modifier: number;
      attack: number;
      saveDc: number;
      focus?: string;
    }
  >();
  for (const cls of casters) {
    const key = abilityKeyById(castingAbilityId(cls));
    if (!key) continue;
    const modifier = abilities.find((ability) => ability.key === key)?.modifier ?? 0;
    const className = cls.definition?.name;
    const attack = modifier + prof + castingBonus(raw, className, 'attack');
    const saveDc = 8 + prof + modifier + castingBonus(raw, className, 'saveDc');
    const focus = castingFocus(cls);
    const signature = `${key}|${attack}|${saveDc}|${focus ?? ''}`;
    const current = profilesByStats.get(signature);
    if (current) current.sources.push(castingSource(cls));
    else {
      profilesByStats.set(signature, {
        sources: [castingSource(cls)],
        ability: key,
        modifier,
        attack,
        saveDc,
        ...(focus ? { focus } : {}),
      });
    }
  }
  const profiles = [...profilesByStats.values()].map((profile) => ({
      source: profile.sources.join(' / '),
      ability: profile.ability.toUpperCase(),
      modifier: profile.modifier,
      attack: profile.attack,
      saveDc: profile.saveDc,
      ...(profile.focus ? { focus: profile.focus } : {}),
    }));
  if (!profiles.length) return undefined;
  const pactClasses = casters.filter(hasPactSlotProgression);
  const standardClasses = casters.filter((cls) => !hasPactSlotProgression(cls));
  const singleClassSlots = standardClasses[0] ? directSlots(standardClasses[0]) : [];
  const slots = trimSlots(
    standardClasses.length === 1 && singleClassSlots.length > 0
      ? singleClassSlots
      : spellSlotsForCasterLevel(combinedCasterLevel(standardClasses)),
  );
  const result: Spellcasting = {
    profiles,
    slots,
  };
  const pactSlots = pactClasses.flatMap((cls) => {
    const row = directSlots(cls);
    const slotLevel = row.findIndex((count) => count > 0);
    return slotLevel >= 0
      ? [{ source: castingSource(cls), level: slotLevel + 1, max: row[slotLevel] }]
      : [];
  });
  if (pactSlots.length) result.pactSlots = pactSlots;
  return result;
}

/** Damage line for an action from its dice, ability modifier, and type. */
function actionDamage(
  action: RawAction,
  modByStatId: (id: number | null | undefined) => number,
): DamageInfo | undefined {
  const dice = action.dice?.diceString ?? '';
  const type = damageTypeName(action.damageTypeId);
  const hasExplicitDamage =
    Boolean(dice) ||
    action.dice?.fixedValue != null ||
    action.value != null ||
    action.damageBonus != null;
  if (!hasExplicitDamage) return undefined;
  const bonus =
    modByStatId(action.abilityModifierStatId) +
    (action.dice?.fixedValue ?? action.value ?? 0) +
    (action.damageBonus ?? 0);
  if (!dice && bonus === 0) return undefined;
  if (!type && action.saveStatId == null && action.displayAsAttack !== true) return undefined;
  const damage: DamageInfo = { dice };
  if (bonus) damage.bonus = bonus;
  if (type) damage.type = type;
  return damage;
}

/** A non-damage die shown in an action's meta line (healing, resource dice,
 * random-table rolls, and similar effects). */
function actionRoll(
  action: RawAction,
  modByStatId: (id: number | null | undefined) => number,
): string | undefined {
  const dice = action.dice?.diceString ?? '';
  if (damageTypeName(action.damageTypeId) || action.saveStatId != null) return undefined;
  const hasExplicitRoll =
    Boolean(dice) ||
    action.dice?.fixedValue != null ||
    action.value != null ||
    action.damageBonus != null;
  if (!hasExplicitRoll) return undefined;
  const bonus =
    modByStatId(action.abilityModifierStatId) +
    (action.dice?.fixedValue ?? action.value ?? 0) +
    (action.damageBonus ?? 0);
  if (!dice) return bonus ? String(bonus) : undefined;
  if (!bonus) return dice;
  return `${dice}${bonus >= 0 ? '+' : ''}${bonus}`;
}

function hasCustomActionDetail(action: RawCustomAction): boolean {
  const hasMechanics =
    action.displayAsAttack === true ||
    action.isProficient === true ||
    action.statId != null ||
    action.toHitBonus != null ||
    action.damageBonus != null ||
    action.diceCount != null ||
    action.diceType != null ||
    action.fixedValue != null ||
    action.damageTypeId != null ||
    action.saveStatId != null ||
    action.fixedSaveDc != null ||
    action.range != null ||
    action.longRange != null ||
    action.aoeType != null ||
    action.aoeSize != null ||
    action.activationType != null;
  const hasText = Boolean(action.description?.trim() || action.snippet?.trim());
  const defaultName = /^Custom Action \d+$/i.test(action.name?.trim() ?? '');
  return hasMechanics || hasText || (!defaultName && Boolean(action.name?.trim()));
}

function customActionToRaw(action: RawCustomAction): RawAction {
  const diceString =
    action.diceCount && action.diceType ? `${action.diceCount}d${action.diceType}` : undefined;
  return {
    name: action.name?.trim(),
    description: action.description,
    snippet: action.snippet,
    displayAsAttack: action.displayAsAttack,
    isProficient: action.isProficient,
    toHitBonus: action.toHitBonus,
    damageBonus: action.damageBonus,
    abilityModifierStatId: action.statId,
    dice:
      diceString || action.fixedValue != null
        ? { diceString, fixedValue: action.fixedValue }
        : undefined,
    damageTypeId: action.damageTypeId,
    saveStatId: action.saveStatId,
    fixedSaveDc: action.fixedSaveDc,
    range: {
      range: action.range,
      longRange: action.longRange,
      aoeType: action.aoeType,
      aoeSize: action.aoeSize,
    },
    activation: { activationType: action.activationType },
  };
}

function customAttack(
  action: RawCustomAction,
  abilities: AbilityScore[],
  level: number,
): Attack | undefined {
  if (action.displayAsAttack !== true || !hasCustomActionDetail(action) || !action.name?.trim()) {
    return undefined;
  }
  const rawAction = customActionToRaw(action);
  const modifier = (id: number | null | undefined) => {
    const key = abilityKeyById(id);
    return abilities.find((ability) => ability.key === key)?.modifier ?? 0;
  };
  const attack: Attack = { name: action.name.trim() };
  if (action.statId != null || action.isProficient || action.toHitBonus != null) {
    attack.toHit =
      modifier(action.statId) +
      (action.isProficient ? proficiencyBonus(level) : 0) +
      (action.toHitBonus ?? 0);
  }
  const damage = actionDamage(rawAction, modifier);
  if (damage) attack.damage = damage;
  const saveKey = abilityKeyById(action.saveStatId);
  if (saveKey) {
    const dc = action.fixedSaveDc ?? 8 + proficiencyBonus(level) + modifier(action.statId);
    attack.save = `DC ${dc} ${saveKey.toUpperCase()}`;
  }
  if (action.range != null && action.range > 0) {
    attack.range =
      action.longRange && action.longRange > action.range
        ? `${action.range}/${action.longRange} ft.`
        : `${action.range} ft.`;
  }
  return attack;
}

/**
 * D&D Beyond `componentTypeId`s that identify a feature grantor: a class
 * feature, a feat, or a racial trait. An action tagged with one of these but
 * whose `componentId` isn't a feature the character actually has is an orphan
 * (a leftover from an unselected option) and is dropped.
 */
const FEATURE_COMPONENT_TYPES = new Set([12168134, 1088085227, 1960452172]);

/** Ids of every feature/feat/trait the character actually has, for grantor checks. */
function grantedFeatureIds(raw: RawCharacter): Set<number> {
  const ids = new Set<number>();
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (feature.id != null) ids.add(feature.id);
    }
    for (const feature of asArray(cls.classFeatures)) {
      if (feature.definition?.id != null) ids.add(feature.definition.id);
    }
  }
  for (const trait of asArray(raw.race?.racialTraits)) {
    if (trait.definition?.id != null) ids.add(trait.definition.id);
  }
  for (const feat of asArray(raw.feats)) {
    if (feat.definition?.id != null) ids.add(feat.definition.id);
  }
  return ids;
}

/** Owning class level for class features and any selected options nested under
 * them. This keeps `{{classlevel}}` correct on multiclass characters. */
function classLevelsByComponent(raw: RawCharacter): Map<number, number> {
  const levels = new Map<number, number>();
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (feature.id != null) levels.set(feature.id, cls.level);
    }
    for (const feature of asArray(cls.classFeatures)) {
      if (feature.definition?.id != null) levels.set(feature.definition.id, cls.level);
    }
  }

  const parents = new Map<number, number>();
  if (raw.options) {
    const groups = [
      raw.options.race,
      raw.options.class,
      raw.options.feat,
      raw.options.background,
      raw.options.item,
    ];
    for (const group of groups) {
      for (const option of asArray(group)) {
        if (option.definition?.id != null && option.componentId != null) {
          parents.set(option.definition.id, option.componentId);
        }
      }
    }
  }

  for (const optionId of parents.keys()) {
    let current = optionId;
    const visited = new Set<number>();
    while (!visited.has(current)) {
      visited.add(current);
      const parent = parents.get(current);
      if (parent == null) break;
      const level = levels.get(parent);
      if (level != null) {
        levels.set(optionId, level);
        break;
      }
      current = parent;
    }
  }
  return levels;
}

/** Spellcasting ability owned by each class feature and nested selected option. */
function castingAbilitiesByComponent(raw: RawCharacter): Map<number, number> {
  const abilities = new Map<number, number>();
  const parents = new Map<number, number>();
  for (const cls of asArray(raw.classes)) {
    const abilityId = castingAbilityId(cls);
    if (abilityId == null) continue;
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (feature.id != null) abilities.set(feature.id, abilityId);
    }
    for (const feature of asArray(cls.classFeatures)) {
      if (feature.definition?.id != null) abilities.set(feature.definition.id, abilityId);
    }
  }
  if (raw.options) {
    const groups = [
      raw.options.race,
      raw.options.class,
      raw.options.feat,
      raw.options.background,
      raw.options.item,
    ];
    for (const group of groups) {
      for (const option of asArray(group)) {
        if (option.definition?.id != null && option.componentId != null) {
          parents.set(option.definition.id, option.componentId);
        }
      }
    }
  }
  for (const optionId of parents.keys()) {
    let current = optionId;
    const visited = new Set<number>();
    while (!visited.has(current)) {
      visited.add(current);
      const parent = parents.get(current);
      if (parent == null) break;
      const ability = abilities.get(parent);
      if (ability != null) {
        abilities.set(optionId, ability);
        break;
      }
      current = parent;
    }
  }
  return abilities;
}

/** Casting class name owned by each class feature and nested selected option. */
function castingClassNamesByComponent(raw: RawCharacter): Map<number, string> {
  const names = new Map<number, string>();
  const parents = new Map<number, number>();
  for (const cls of asArray(raw.classes)) {
    const className = cls.definition?.name;
    if (!className || castingAbilityId(cls) == null) continue;
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (feature.id != null) names.set(feature.id, className);
    }
    for (const feature of asArray(cls.classFeatures)) {
      if (feature.definition?.id != null) names.set(feature.definition.id, className);
    }
  }
  if (raw.options) {
    const groups = [
      raw.options.race,
      raw.options.class,
      raw.options.feat,
      raw.options.background,
      raw.options.item,
    ];
    for (const group of groups) {
      for (const option of asArray(group)) {
        if (option.definition?.id != null && option.componentId != null) {
          parents.set(option.definition.id, option.componentId);
        }
      }
    }
  }
  for (const optionId of parents.keys()) {
    let current = optionId;
    const visited = new Set<number>();
    while (!visited.has(current)) {
      visited.add(current);
      const parent = parents.get(current);
      if (parent == null) break;
      const className = names.get(parent);
      if (className) {
        names.set(optionId, className);
        break;
      }
      current = parent;
    }
  }
  return names;
}

/** True when a description carries D&D Beyond's "benefits you gain" bullet list. */
function hasEffectList(description: string | null | undefined): boolean {
  return /class="[^"]*\beffect-info\b/i.test(description ?? '');
}

/**
 * Drop a narrative lead-in that precedes an action's activation, so its blurb
 * starts at the mechanics ("As a Bonus Action, you can…") instead of backstory
 * ("An event in your past left an indelible mark on you…").
 */
function dropLeadInFlavor(text: string): string {
  const trigger = /\bAs an? (?:Bonus Action|Reaction|Free Action|Magic Action|Action)\b/i.exec(text);
  return trigger && trigger.index > 0 ? text.slice(trigger.index) : text;
}

/**
 * Drop a trailing limited-use / recharge sentence ("You can use this feature
 * twice, … when you finish a Long Rest.") — the action already shows its uses as
 * checkboxes, so repeating it in the blurb is redundant.
 */
function dropUsesSentence(text: string): string {
  let result = text.trim();
  let previous = '';
  while (result !== previous) {
    previous = result;
    result = result
      .replace(
        /\s*(?:You can use (?:this|it)\b[^.!?]*|Once used,[^.!?]*|You regain\b[^.!?]*)\b(?:Short Rest|Long Rest|Short or Long Rest)\.?\s*$/i,
        '',
      )
      .trim();
  }
  return result;
}

/**
 * A concise blurb of what an action does. D&D Beyond's hand-written snippet is
 * normally the cleanest source, but when it paraphrases away the action's actual
 * effects — which D&D Beyond spells out in a benefit list (e.g. Innate Sorcery's
 * "+1 spell save DC / Advantage on spell attacks") — use the description instead,
 * trimmed of its lead-in flavor and the recharge line shown as use checkboxes.
 */
function actionDetail(
  snippet: string | null | undefined,
  description: string | null | undefined,
  resolvePlaceholders: (text: string) => string,
): string {
  if (!hasEffectList(description)) {
    return summarize(snippet || description, 400, resolvePlaceholders);
  }
  const full = summarize(description, 1200, resolvePlaceholders);
  return summarize(dropUsesSentence(dropLeadInFlavor(full)), 400);
}

function withoutRedundantActionDamage(summary: string, damage: DamageInfo | undefined): string {
  const dice = damage?.dice.trim();
  if (!dice) return summary;
  const diceParts = /^(\d+)(d\d+)(.*)$/i.exec(dice);
  const escaped = diceParts
    ? `${diceParts[1]}(?:\\*\\*)?${diceParts[2]}(?:\\*\\*)?${diceParts[3].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
    : dice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return summary
    .replace(
      new RegExp(
        `\\b(?:an?\\s+)?(extra\\s+)?${escaped}\\s+(?=(?:damage\\b|[A-Z][a-z]+(?:\\s+damage\\b|,|\\s+or\\b)))`,
        'i',
      ),
      (_match, extra: string | undefined) => extra ?? '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Action-economy options from every source, deduped, each enriched with its
 * limited-use checkboxes, damage, save, and range. Grouped downstream into
 * Action / Bonus Action / Reaction / Other by activation type. Weapon attacks
 * live in the Attacks card; only orphaned options (granted by a feature the
 * character doesn't have) are dropped.
 *
 * `resourceComponentIds` collects the grantor id of every displayed action that
 * shows its own checkboxes, so the caller can suppress the duplicate tracker on
 * the granting feature (e.g. Channel Divinity's uses live on its action).
 * `actionReferencesByComponent` maps each grantor id to its action names and
 * whether the Actions card has substantive detail worth pointing to.
 */
interface ActionReference {
  name: string;
  hasDetail: boolean;
  isActivation: boolean;
}

function resolveActions(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
  grantedIds: Set<number>,
  companionComponentIds: Set<number>,
  resolvePlaceholders: PlaceholderResolver,
): {
  actions: CharacterAction[];
  resourceComponentIds: Set<number>;
  actionReferencesByComponent: Map<number, ActionReference[]>;
} {
  const modByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  const modByStatId = (id: number | null | undefined) =>
    modByKey.get(abilityKeyById(id) ?? ('' as AbilityKey)) ?? 0;
  const saveDc = spellSaveDc(raw, abilities, level);
  const classLevelByComponent = classLevelsByComponent(raw);
  const castingAbilityByComponent = castingAbilitiesByComponent(raw);
  const castingClassByComponent = castingClassNamesByComponent(raw);

  const actions: CharacterAction[] = [];
  const resourceComponentIds = new Set<number>();
  const actionReferencesByComponent = new Map<number, ActionReference[]>();
  const seen = new Set<string>();
  const customActions = asArray(raw.customActions)
    .filter((action) => action.displayAsAttack !== true && hasCustomActionDetail(action))
    .map(customActionToRaw);
  for (const group of [...Object.values(raw.actions ?? {}), customActions]) {
      for (const action of asArray<RawAction>(group)) {
        const category = actionCategory(action.activation?.activationType);
        if (!action.name || seen.has(action.name)) continue;
        // Skip actions granted by a feature the character doesn't have (an
        // orphaned option, e.g. a subclass path that wasn't chosen).
        if (
          action.componentTypeId != null &&
          FEATURE_COMPONENT_TYPES.has(action.componentTypeId) &&
          action.componentId != null &&
          !grantedIds.has(action.componentId)
        ) {
          continue;
        }
        seen.add(action.name);

        const entry: CharacterAction = { name: action.name, category };
        if (action.componentId != null && companionComponentIds.has(action.componentId)) {
          entry.related = ['companions'];
        }
        const resource = limitedUseToPool(action.limitedUse, level);
        if (resource) {
          // A pool that resets on a long rest but also regains one use on a
          // short rest (Channel Divinity): the reset type only records the long
          // rest, so read the short-rest recovery from the blurb and show both.
          if (
            resource.recovery?.kind === 'rest' &&
            resource.recovery.rest === 'long' &&
            regainsOneOnShortRest(action.snippet, action.description)
          ) {
            resource.recovery = { kind: 'partial-short-full-long', shortRestUses: 1 };
          }
          const alternateRecovery = alternateRecoveryOptions(
            action.snippet,
            action.description,
          );
          if (alternateRecovery.length) resource.alternateRecovery = alternateRecovery;
          entry.resource = resource;
          if (action.componentId != null) resourceComponentIds.add(action.componentId);
        }
        const damage = actionDamage(action, modByStatId);
        if (damage) entry.damage = damage;
        const roll = damage ? undefined : actionRoll(action, modByStatId);
        if (roll) entry.roll = roll;
        const saveKey = abilityKeyById(action.saveStatId);
        if (saveKey) {
          const ownerAbility =
            action.componentId == null
              ? abilityKeyById(action.abilityModifierStatId)
              : abilityKeyById(castingAbilityByComponent.get(action.componentId));
          const ownerModifier = abilities.find((ability) => ability.key === ownerAbility)?.modifier;
          const ownerClass =
            action.componentId == null
              ? undefined
              : castingClassByComponent.get(action.componentId);
          const ownerSaveDc =
            ownerModifier == null || ownerAbility == null
              ? saveDc
              : 8 +
                proficiencyBonus(level) +
                ownerModifier +
                (ownerClass ? castingSaveDcBonus(raw, ownerAbility, ownerClass) : 0);
          entry.save = `DC ${action.fixedSaveDc ?? ownerSaveDc} ${saveKey.toUpperCase()}`;
        }
        const range = action.range?.range;
        if (range) entry.range = `${range} ft.`;
        const actionResolver = (text: string) =>
          resolvePlaceholders(text, {
            classLevel:
              action.componentId == null
                ? undefined
                : classLevelByComponent.get(action.componentId),
            castingClass:
              action.componentId == null
                ? undefined
                : castingClassByComponent.get(action.componentId),
            limitedUse: resource?.max,
            scaleValue: action.dice?.diceString ?? action.value ?? undefined,
          });
        const detail = actionDetail(action.snippet, action.description, actionResolver);
        const structuredBenefits = structuredFeatureBenefits(action.snippet, actionResolver);
        const summary =
          structuredBenefits?.summary ??
          (resource ? dropUsesSentence(dropAlternateRecoverySentences(detail)) : detail);
        const conciseSummary = withoutRedundantActionDamage(summary, damage);
        if (conciseSummary) entry.summary = conciseSummary;
        const benefitList = structuredBenefits?.parts?.[0]?.list;
        if (benefitList?.items.length) entry.list = benefitList;
        if (action.componentId != null) {
          const reference: ActionReference = {
            name: action.name,
            hasDetail: Boolean(
              entry.summary ||
                entry.resource ||
                entry.damage ||
                entry.roll ||
                entry.save ||
                entry.range,
            ),
            isActivation: category !== 'other',
          };
          const references = actionReferencesByComponent.get(action.componentId);
          if (references) references.push(reference);
          else actionReferencesByComponent.set(action.componentId, [reference]);
        }
        actions.push(entry);
      }
  }
  return { actions, resourceComponentIds, actionReferencesByComponent };
}

/** Casting-time shorthand from a spell's activation (A / BA / R / 1m / 1h). */
function spellCastingTime(activation: RawSpellDefinition['activation']): string {
  const time = activation?.activationTime ?? 1;
  switch (activation?.activationType) {
    case 1:
      return 'A';
    case 3:
      return 'BA';
    case 4:
      return 'R';
    case 6:
      return `${time}m`;
    case 7:
      return `${time}h`;
    default:
      return '';
  }
}

/** Range shorthand including any area of effect, e.g. "Self (15-ft. cone)". */
function spellRangeLabel(range: RawSpellDefinition['range']): string {
  if (!range) return '';
  const origin = range.origin ?? '';
  let base: string;
  if (origin === 'Self') base = 'Self';
  else if (origin === 'Touch') base = 'Touch';
  else if (range.rangeValue) base = `${range.rangeValue} ft.`;
  else base = origin;
  if (range.aoeValue) {
    const shape = typeof range.aoeType === 'string' ? ` ${range.aoeType.toLowerCase()}` : '';
    base = base ? `${base} (${range.aoeValue}-ft.${shape})` : `${range.aoeValue}-ft.${shape}`;
  }
  return base;
}

/** Component letters present, e.g. "V, S, M". */
const COMPONENT_LABEL: Record<number, string> = { 1: 'V', 2: 'S', 3: 'M' };
function spellComponents(components: number[] | null | undefined): string {
  return asArray(components)
    .map((id) => COMPONENT_LABEL[id])
    .filter(Boolean)
    .join(', ');
}

/** Material text worth printing: monetary costs and components the spell consumes. */
function significantSpellMaterial(description: string | null | undefined): string | undefined {
  if (!description) return undefined;
  const material = plainText(description);
  return /\b\d[\d,]*(?:\+)?\s*(?:cp|sp|ep|gp|pp)\b/i.test(material) ||
    /\b(?:the spell consumes|consumed by the spell)\b/i.test(material)
    ? material
    : undefined;
}

function higherLevelSpellRule(
  html: string | null | undefined,
  damage: DamageInfo | undefined,
  spellLevel: number,
): string | undefined {
  if (html) {
    for (const paragraph of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
      if (!/^Using a Higher-Level Spell Slot\b/i.test(plainText(paragraph[0]))) continue;
      return richText(paragraph[0]).replace(
        /^(Using a Higher-Level Spell Slot\.)\s*/i,
        '**$1** ',
      );
    }
  }
  const dice = /^\+(\S+) per slot level above\b/i.exec(damage?.scaling ?? '')?.[1];
  return dice
    ? `**Using a Higher-Level Spell Slot.** The damage increases by ${dice} for each spell slot level above ${spellLevel}.`
    : undefined;
}

function withoutHigherLevelSpellRule(
  html: string | null | undefined,
): string | null | undefined {
  if (!html) return html;
  return html.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (paragraph) =>
    /^Using a Higher-Level Spell Slot\b/i.test(plainText(paragraph)) ? ' ' : paragraph,
  );
}

/** Drop a cantrip scaling paragraph when it only restates current damage metadata. */
function withoutRedundantSpellDamageScaling(
  html: string | null | undefined,
  ownsScaling: boolean,
): string | null | undefined {
  if (!html || !ownsScaling) return html;
  return html.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (paragraph) => {
    const text = plainText(paragraph);
    return /^Cantrip Upgrade\.?\s+The damage increases by\b[^.]*\.?$/i.test(
      text,
    )
      ? ' '
      : paragraph;
  });
}

/** Duration value; concentration is represented separately on spell entries. */
function spellDuration(duration: RawSpellDefinition['duration']): string {
  if (!duration) return '';
  if (duration.durationType === 'Instantaneous') return 'Instant';
  const interval = duration.durationInterval ?? 0;
  const unit = duration.durationUnit?.toLowerCase();
  const displayUnit = interval !== 1 && unit && !unit.endsWith('s') ? `${unit}s` : unit;
  return (
    interval && displayUnit
      ? `${interval} ${displayUnit}`
      : duration.durationType === 'Concentration'
        ? ''
        : (duration.durationType ?? '')
  );
}

function spellLevelOrdinal(level: number): string {
  if (level === 1) return '1st';
  if (level === 2) return '2nd';
  if (level === 3) return '3rd';
  return `${level}th`;
}

function perSlotDamageIncrease(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  for (const paragraph of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = plainText(paragraph[0]);
    if (!/^Using a Higher-Level Spell Slot\b/i.test(text)) continue;
    return text.match(
      /\bdamage increases by\s+(\d+d\d+)\s+for (?:each|every) (?:spell )?slot level above\b/i,
    )?.[1];
  }
  return undefined;
}

/** Base damage dice + type + upcast scaling from a spell's modifiers. */
function spellDamage(def: RawSpellDefinition, characterLevel: number): DamageInfo | undefined {
  const damageMods = asArray(def.modifiers).filter(
    (entry) => entry.type === 'damage' && entry.die?.diceString,
  );
  const mod = damageMods[0];
  if (!mod?.die?.diceString) return undefined;
  const damage: DamageInfo = { dice: mod.die.diceString };
  const types = [
    ...new Set(damageMods.map((entry) => entry.friendlySubtypeName).filter(Boolean)),
  ];
  if (types.length > 1 && damageMods.every((entry) => entry.die?.diceString === damage.dice)) {
    damage.type = 'chosen type';
  } else if (mod.friendlySubtypeName) {
    damage.type = mod.friendlySubtypeName;
  }

  // A cantrip scales with CHARACTER level: show its dice at the current level
  // (no "increases with level" note — just the value it's at now).
  if ((def.level ?? 0) === 0 && def.scaleType === 'characterlevel') {
    const explicitTier = asArray(mod.atHigherLevels?.higherLevelDefinitions)
      .filter((entry) => (entry.level ?? Number.POSITIVE_INFINITY) <= characterLevel)
      .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
    if (explicitTier?.dice?.diceString) {
      damage.dice = explicitTier.dice.diceString;
    } else if (!/\b(?:additional (?:attack|beam)|damage die changes?)\b/i.test(def.description ?? '')) {
      const multiplier = cantripDiceMultiplier(characterLevel);
      if (multiplier > 1 && mod.die.diceValue) {
        damage.dice = `${(mod.die.diceCount ?? 1) * multiplier}d${mod.die.diceValue}`;
      }
    }
    return damage;
  }

  // Only call damage scaling "per slot level" when the rules text says it is.
  // Some definitions contain absolute threshold dice (for example, 2d4 at
  // level 5 and 3d4 at level 7), which must not be presented as increments.
  const increase = perSlotDamageIncrease(def.description);
  if (increase) {
    damage.scaling =
      `+${increase} per slot level above ${spellLevelOrdinal(def.level ?? 1)}`;
  }
  return damage;
}

/** Selected-option definition id -> the feature/option that offered it. */
function selectedOptionParents(raw: RawCharacter): Map<number, number> {
  const parents = new Map<number, number>();
  const options = raw.options;
  if (!options) return parents;
  const groups = [options.race, options.class, options.feat, options.background, options.item];
  for (const group of groups) {
    for (const option of asArray(group)) {
      if (option.definition?.id != null && option.componentId != null) {
        parents.set(option.definition.id, option.componentId);
      }
    }
  }
  return parents;
}

/** Spell names attributed to their granting component and every selected-option
 * ancestor. This lets a displayed feature list its active spells even when the
 * spell points at a nested choice rather than the feature itself. */
function featureSpellNamesByComponent(raw: RawCharacter): Map<number, string[]> {
  const namesByComponent = new Map<number, Set<string>>();
  const optionParents = selectedOptionParents(raw);
  const add = (spell: RawSpell) => {
    const name = spell.definition?.name;
    if (!name || spell.componentId == null || spell.componentId <= 0) return;
    let componentId = spell.componentId;
    const visited = new Set<number>();
    while (!visited.has(componentId)) {
      visited.add(componentId);
      const names = namesByComponent.get(componentId);
      if (names) names.add(name);
      else namesByComponent.set(componentId, new Set([name]));
      const parent = optionParents.get(componentId);
      if (parent == null) break;
      componentId = parent;
    }
  };
  for (const group of asArray(raw.classSpells)) asArray(group.spells).forEach(add);
  if (raw.spells) {
    for (const group of Object.values(raw.spells)) asArray<RawSpell>(group).forEach(add);
  }
  return new Map(
    [...namesByComponent].map(([componentId, names]) => [componentId, [...names]]),
  );
}

/** Known/prepared spells from class spells and other sources, deduped and sorted. */
function resolveSpells(
  raw: RawCharacter,
  level: number,
  resolvePlaceholders: PlaceholderResolver,
): SpellEntry[] {
  const disguiseFeatIds = new Set<number>();
  for (const feat of asArray(raw.feats)) {
    if (isDisguiseFeat(feat) && feat.definition?.id != null) {
      disguiseFeatIds.add(feat.definition.id);
    }
  }
  const classLevelByComponent = classLevelsByComponent(raw);
  const castingClassByComponent = castingClassNamesByComponent(raw);
  const featureNames = new Map<number, string>();
  const addFeatureName = (definition: { id?: number; name?: string | null } | null | undefined) => {
    if (definition?.id != null && definition.name) featureNames.set(definition.id, definition.name);
  };
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) addFeatureName(feature);
    for (const feature of asArray(cls.classFeatures)) addFeatureName(feature.definition);
  }
  for (const trait of asArray(raw.race?.racialTraits)) addFeatureName(trait.definition);
  for (const feat of asArray(raw.feats)) addFeatureName(feat.definition);

  // A spell can point at a selected sub-option (e.g. "Drow Lineage - Wisdom")
  // rather than the feature that owns it. Walk those option-parent links to the
  // displayed feature name used elsewhere on the sheet.
  const optionParents = selectedOptionParents(raw);
  const sourceFor = (componentId: number | null | undefined): string => {
    if (componentId == null) return 'Feature cast';
    let current = componentId;
    const visited = new Set<number>();
    while (!visited.has(current)) {
      visited.add(current);
      const name = featureNames.get(current);
      if (name) return name;
      const parent = optionParents.get(current);
      if (parent == null) break;
      current = parent;
    }
    return 'Feature cast';
  };

  const byName = new Map<string, SpellEntry>();
  const add = (spell: RawSpell) => {
    const def = spell.definition;
    if (
      def?.name == null ||
      (spell.componentId != null && disguiseFeatIds.has(spell.componentId))
    ) return;
    const hasCompanion = hasCompanionStatBlock(def.description || def.snippet, def.name);
    const pool = limitedUseToPool(spell.limitedUse, level);
    const featureUse = pool ? { source: sourceFor(spell.componentId), pool } : undefined;
    const existing = byName.get(def.name);
    if (existing) {
      // A spell can be both a prepared class spell and a feature-granted free
      // cast. Keep one spell row while preserving every distinct grant pool.
      if (
        featureUse &&
        !existing.featureUses?.some(
          (use) => use.source === featureUse.source && JSON.stringify(use.pool) === JSON.stringify(pool),
        )
      ) {
        (existing.featureUses ??= []).push(featureUse);
      }
      if (hasCompanion && !existing.related?.includes('companions')) {
        existing.related = [...(existing.related ?? []), 'companions'];
      }
      return;
    }
    const entry: SpellEntry = { name: def.name, level: def.level ?? 0 };
    const spellAbility = abilityKeyById(spell.spellCastingAbilityId);
    if (spellAbility) entry.ability = spellAbility.toUpperCase();
    if (def.school) entry.school = def.school;
    const castingTime = spellCastingTime(def.activation);
    if (castingTime) entry.castingTime = castingTime;
    const range = spellRangeLabel(def.range);
    if (range) entry.range = range;
    const components = spellComponents(def.components);
    if (components) entry.components = components;
    const material = significantSpellMaterial(def.componentsDescription);
    if (material) entry.material = material;
    const duration = spellDuration(def.duration);
    if (duration) entry.duration = duration;
    if (def.concentration) entry.concentration = true;
    if (def.ritual) entry.ritual = true;
    if (def.requiresSavingThrow) {
      const saveKey = abilityKeyById(def.saveDcAbilityId);
      if (saveKey) entry.save = saveKey.toUpperCase();
    }
    if (def.requiresAttackRoll) entry.attack = true;
    const damage = spellDamage(def, level);
    if (damage) entry.damage = damage;
    const upcast = higherLevelSpellRule(def.description, damage, def.level ?? 0);
    if (upcast) entry.upcast = upcast;
    if (spell.prepared) entry.prepared = true;
    const spellResolver = (text: string) =>
      resolvePlaceholders(text, {
        classLevel:
          spell.componentId == null
            ? undefined
            : classLevelByComponent.get(spell.componentId),
        castingClass:
          spell.componentId == null
            ? undefined
            : castingClassByComponent.get(spell.componentId),
      });
    const description = withoutRedundantSpellDamageScaling(
      withoutHigherLevelSpellRule(
        withoutCompanionStatBlocks(def.description, def.name),
      ),
      Boolean(
        damage &&
          (((def.level ?? 0) === 0 && def.scaleType === 'characterlevel') || damage.scaling),
      ),
    );
    const snippet = withoutCompanionStatBlocks(def.snippet, def.name);
    const structured = spellStructuredContent(description, spellResolver);
    const summary = structured
      ? summarize(structured.intro || snippet, 400)
      : summarize(snippet || description, 400, spellResolver);
    if (summary) entry.summary = summary;
    if (structured?.list.items.length) entry.list = structured.list;
    if (featureUse) entry.featureUses = [featureUse];
    if (hasCompanion) entry.related = ['companions'];
    byName.set(def.name, entry);
  };
  for (const group of asArray(raw.classSpells)) asArray(group.spells).forEach(add);
  if (raw.spells) {
    for (const group of Object.values(raw.spells)) asArray<RawSpell>(group).forEach(add);
  }
  return [...byName.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

/** Carried items with quantity and equipped/attuned flags. */
function resolveInventory(raw: RawCharacter): InventoryEntry[] {
  const standard = asArray(raw.inventory)
    .filter((item) => item.definition?.name)
    .map((item) => ({
      name: item.definition!.name!,
      quantity: item.quantity ?? 1,
      equipped: item.equipped === true,
      attuned: item.isAttuned === true,
    }));
  const standardIds = new Set(
    asArray(raw.inventory).map((item) => String(item.id)).filter(Boolean),
  );
  const custom = asArray(raw.customItems)
    .filter((item) => item.id == null || !standardIds.has(String(item.id)))
    .flatMap((item) => {
      const name = item.name?.trim() || item.definition?.name?.trim();
      return name
        ? [{
            name,
            quantity: item.quantity ?? 1,
            equipped: item.equipped === true,
            attuned: item.isAttuned === true,
          }]
        : [];
    });
  return [...standard, ...custom];
}

/** Coin counts, defaulting missing denominations to zero. */
function resolveWealth(raw: RawCharacter): Coins {
  const coins = raw.currencies ?? {};
  return {
    cp: coins.cp ?? 0,
    sp: coins.sp ?? 0,
    ep: coins.ep ?? 0,
    gp: coins.gp ?? 0,
    pp: coins.pp ?? 0,
  };
}

/** Resolve a raw limited-use block into a checkbox pool, or nothing when the
 * feature/action isn't actually rationed. A pool whose size scales with the
 * proficiency bonus (`maxUses` 0) is expanded to that bonus. */
function limitedUseToPool(
  limitedUse: RawLimitedUse | null | undefined,
  level: number,
): ResourcePool | undefined {
  if (!limitedUse) return undefined;
  let max = limitedUse.maxUses ?? 0;
  if (max <= 0 && limitedUse.useProficiencyBonus) max = proficiencyBonus(level);
  if (max < 1) return undefined;
  const recovery =
    limitedUse.resetType === 1
      ? ({ kind: 'rest', rest: 'short' } as const)
      : limitedUse.resetType === 2
        ? ({ kind: 'rest', rest: 'long' } as const)
        : undefined;
  return recovery ? { max, recovery } : { max };
}

const COUNT_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
};

function normalizeRecoveryCost(cost: string): string {
  const clean = cost
    .replace(/\([^)]*no action required[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const count = /^(a|an|one|two|three)\b/i.exec(clean);
  return count
    ? `${COUNT_WORDS[count[1].toLowerCase()]}${clean.slice(count[0].length)}`
    : clean;
}

function alternateRecoveryFromSentence(sentence: string): AlternateRecovery | undefined {
  const restoreThenSpend =
    /\b(?:restore|regain)\s+(all|a|one|two|three|\d+)\b[^.]*?\buses?\b[^.]*?\bby\s+(?:spending|expending)\s+(.+?)(?:\.|$)/i.exec(
      sentence,
    );
  if (restoreThenSpend) {
    const restores = restoreThenSpend[1].toLowerCase() === 'all'
      ? 'all'
      : (COUNT_WORDS[restoreThenSpend[1].toLowerCase()] ?? Number(restoreThenSpend[1]));
    return { restores, cost: normalizeRecoveryCost(restoreThenSpend[2]) };
  }

  const spendThenRestore =
    /\bunless\s+you\s+(?:spend|expend)\s+(.+?)\s+(?:\([^)]*\)\s*)?to\s+(?:restore|regain)\b[^.]*?\buses?\b/i.exec(
      sentence,
    );
  if (spendThenRestore) {
    return { restores: 1, cost: normalizeRecoveryCost(spendThenRestore[1]) };
  }
  return undefined;
}

function alternateRecoveryOptions(
  ...texts: (string | null | undefined)[]
): AlternateRecovery[] {
  const text = plainText(texts.filter(Boolean).join(' '));
  const options: AlternateRecovery[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const option = alternateRecoveryFromSentence(sentence);
    if (
      option &&
      option.cost &&
      !options.some(
        (current) => current.restores === option.restores && current.cost === option.cost,
      )
    ) {
      options.push(option);
    }
  }
  return options;
}

function dropAlternateRecoverySentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !alternateRecoveryFromSentence(sentence))
    .join(' ')
    .trim();
}

/**
 * True when a blurb says a single use is regained on a short rest on top of the
 * full reset the reset type already captures (e.g. Channel Divinity's "regain
 * one of its expended uses when you finish a Short Rest").
 */
function regainsOneOnShortRest(...texts: (string | null | undefined)[]): boolean {
  const text = texts.filter(Boolean).join(' ');
  return /\bregain\s+(?:one|1|a)\b[^.]*\bshort rest\b/i.test(text);
}

/**
 * Map each feature/feat/trait id to its limited-use pool, taken from the ACTION
 * the feature grants (the actions carry the authoritative use counts — e.g.
 * Channel Divinity's "twice per long rest" lives on its action, not the
 * feature). Features with no rationed action get no checkboxes.
 */
function resolveResourceMap(raw: RawCharacter, level: number): Map<number, ResourcePool> {
  const map = new Map<number, ResourcePool>();
  if (!raw.actions) return map;
  for (const group of Object.values(raw.actions)) {
    for (const action of asArray<RawAction>(group)) {
      if (action.componentId == null) continue;
      const pool = limitedUseToPool(action.limitedUse, level);
      if (pool) map.set(action.componentId, pool);
    }
  }
  return map;
}

/** Remove D&D Beyond's level prefix from repeated progression entries such as
 * "4: Weapon Mastery" and "9: Expertise". The base mechanic is rendered once. */
function classFeatureDisplayName(name: string): string {
  return name.replace(/^\d+\s*:\s*/, '').trim();
}

/** Class-progression entries whose resolved mechanics already live on a
 * dedicated sheet card, or which are builder placeholders rather than usable
 * features. Applied only to class features, never to selected feats. */
function isStructuralClassFeature(name: string): boolean {
  const displayName = classFeatureDisplayName(name);
  return (
    /^Core .+ Traits$/.test(displayName) ||
    /^(?:Hit Points|Proficiencies|Epic Boon)$/.test(displayName) ||
    /^Ability Score (?:Improvement|Increase)s?$/.test(displayName) ||
    / Subclass$/.test(displayName)
  );
}

/**
 * Spell-granting "summary" features whose sub-parts (cantrips, spell slots,
 * preparing spells, spellcasting ability, …) merely restate the general casting
 * rules already shown on the Spells card — so only their intro blurb is kept.
 */
const SPELLCASTING_FEATURE = /^Spellcasting$|^Pact Magic$/;

/**
 * Ability-score-boost features (the "Ability Score Improvement" feat, a
 * background's "… Ability Score Increase(s)", etc.). When such a feature granted
 * ability bonuses we show just those bumps instead of the generic rules text; one
 * that granted none (the generic "Ability Score Increases" rules placeholder)
 * falls through and keeps its own description.
 */
const ABILITY_SCORE_FEATURE = /Ability Score (?:Improvement|Increase)s?$/;

/** A bare ability or damage-type option is a parameter of its owning feature,
 * not a useful feature name on its own. Return the concise qualifier to append. */
function choiceQualifier(name: string): string | undefined {
  const ability = ABILITIES.find(
    (entry) => entry.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (ability) return ability.name;
  const normalized = name.trim().replace(/\s+Damage$/i, '').toLowerCase();
  return Object.values(DAMAGE_TYPES).find((type) => type.toLowerCase() === normalized);
}

/**
 * The ability-score bonuses a feature granted, keyed by its component id, as a
 * short "+2 Wisdom, +1 Constitution" summary (biggest bump first). Returns
 * nothing when the feature granted no ability-score bonus.
 */
function abilityScoreIncreases(
  raw: RawCharacter,
  componentId: number | undefined,
): string | undefined {
  if (componentId == null || !raw.modifiers) return undefined;
  const bumps: { meta: AbilityMeta; value: number }[] = [];
  for (const mods of Object.values(raw.modifiers)) {
    for (const mod of asArray<RawModifier>(mods)) {
      if (mod.type !== 'bonus' || mod.componentId !== componentId) continue;
      const ability = /^(.+)-score$/.exec(mod.subType ?? '')?.[1];
      const meta = ability && ABILITIES.find((entry) => entry.name.toLowerCase() === ability);
      const value = mod.value ?? mod.fixedValue ?? 0;
      if (meta && value) bumps.push({ meta, value });
    }
  }
  if (!bumps.length) return undefined;
  bumps.sort((a, b) => b.value - a.value || a.meta.id - b.meta.id);
  return bumps.map((bump) => `+${bump.value} ${bump.meta.name}`).join(', ');
}

/** Selected ability from a feat's required builder choice. `null` means D&D
 * Beyond published the choice but the character has not completed it yet;
 * `undefined` means this feat has no such choice record. */
function selectedFeatAbilityIncrease(
  raw: RawCharacter,
  featId: number | undefined,
  rulesText: string,
): string | null | undefined {
  if (featId == null) return undefined;
  const choice = asArray(raw.choices?.feat).find((entry) => entry.componentId === featId);
  if (!choice) return undefined;
  if (choice.optionValue == null) return null;

  const selectedOption = asArray(raw.choices?.choiceDefinitions)
    .flatMap((definition) => asArray(definition.options))
    .find((option) => option.id === choice.optionValue);
  const selectedName =
    selectedOption?.label ??
    asArray(raw.options?.feat).find((option) => option.definition?.id === choice.optionValue)
      ?.definition?.name;
  if (!selectedName) return undefined;
  const ability = ABILITIES.find((entry) =>
    new RegExp(`\\b${entry.name}\\b`, 'i').test(selectedName),
  );
  if (!ability) return undefined;
  const amount = Number(/\bby\s+(\d+)\b/i.exec(rulesText)?.[1] ?? 1);
  return `+${amount} ${ability.name}`;
}

/** Remove standalone feat category/prerequisite metadata before parsing the
 * feat's actual benefits (e.g. "General Feat (Prerequisite: Level 4+)"). */
function stripFeatMetadata(html: string | null | undefined): string | null | undefined {
  if (!html) return html;
  return html.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (paragraph) =>
    /^(?:Origin|General|Fighting Style|Epic Boon) Feat(?:\s*\([^)]*\))?$/i.test(
      plainText(paragraph),
    )
      ? ' '
      : paragraph,
  );
}

/** Concrete skills/tools/languages a feature granted, replacing generic choice text. */
function featureProficiencies(
  raw: RawCharacter,
  componentId: number | undefined,
): {
  text: string;
  related: SectionKey[];
  grants: { label: string; items: string[] }[];
} | undefined {
  if (componentId == null) return undefined;
  const names: string[] = [];
  const related = new Set<SectionKey>();
  const skillKeys = new Set(SKILLS.map((skill) => skill.key));
  const grouped = new Map<string, string[]>();
  for (const modifiers of Object.values(raw.modifiers ?? {})) {
    for (const mod of asArray<RawModifier>(modifiers)) {
      if (
        mod.componentId !== componentId ||
        (mod.type !== 'proficiency' && mod.type !== 'language')
      ) {
        continue;
      }
      const subType = mod.subType ?? '';
      if (subType.endsWith('-saving-throws')) continue;
      const name = mod.friendlySubtypeName?.trim();
      if (name && !names.includes(name)) {
        names.push(name);
        const label =
          mod.type === 'language'
            ? 'Languages'
            : skillKeys.has(subType)
              ? 'Skills'
              : subType.includes('armor') || subType === 'shields'
                ? 'Armor'
                : subType.includes('weapon')
                  ? 'Weapons'
                  : 'Tools';
        const items = grouped.get(label) ?? [];
        items.push(name);
        grouped.set(label, items);
      }
      related.add(skillKeys.has(subType) ? 'skills' : 'proficiencies');
    }
  }
  return names.length
    ? {
        text: names.join(', '),
        related: [...related],
        grants: [...grouped].map(([label, items]) => ({ label, items })),
      }
    : undefined;
}

function firstFeatureSentence(
  text: string | null | undefined,
  resolvePlaceholders: (text: string) => string,
): string {
  if (!text) return '';
  const firstParagraph = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(text)?.[1] ?? text;
  const resolved = plainText(resolvePlaceholders(firstParagraph));
  return /^.*?[.!?](?=\s|$)/.exec(resolved)?.[0] ?? resolved;
}

function concreteProficiencySummary(
  featureName: string | undefined,
  proficiencyText: string,
  description: string | null | undefined,
  resolvePlaceholders: (text: string) => string,
): string {
  if (!featureName || featureName.trim().toLowerCase() !== proficiencyText.toLowerCase()) {
    return proficiencyText;
  }
  const sentence = firstFeatureSentence(description, resolvePlaceholders);
  const escapedName = featureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutName = sentence
    .replace(new RegExp(`^You know ${escapedName},?\\s*`, 'i'), '')
    .trim();
  if (!withoutName || withoutName === sentence) return sentence || proficiencyText;
  return `${withoutName[0].toUpperCase()}${withoutName.slice(1)}`;
}

/** Dedicated sections represented by a feature's pure modifier effects. */
function modifierRelatedSections(
  raw: RawCharacter,
  componentId: number | undefined,
): SectionKey[] {
  if (componentId == null) return [];
  const related = new Set<SectionKey>();
  for (const modifiers of Object.values(raw.modifiers ?? {})) {
    for (const mod of asArray<RawModifier>(modifiers)) {
      if (mod.componentId !== componentId) continue;
      if (
        (mod.type === 'advantage' || mod.type === 'disadvantage') &&
        (mod.subType === 'saving-throws' || mod.subType?.endsWith('-saving-throws'))
      ) {
        related.add('savingThrows');
      }
    }
  }
  return [...related];
}

/** Category tag D&D Beyond puts on placeholder "feats" that aren't real feats. */
const DISGUISE_FEAT_TAG = '__DISGUISE_FEAT';

/** True when a feat is a data-origin placeholder rather than a chosen feat. */
function isDisguiseFeat(feat: RawFeat): boolean {
  return asArray(feat.definition?.categories).some(
    (category) => category.tagName === DISGUISE_FEAT_TAG,
  );
}

/**
 * Map from a "choose one" feature's id to the option the character selected,
 * built from `raw.options`. Only options that carry their own rules text (a
 * non-empty snippet) are included: those are real benefits (e.g. an Elven
 * lineage) that should replace the choice prompt on the sheet. Options with an
 * empty snippet are minor parameters (a spellcasting ability, an ability-score
 * bump) and are left attached to their base feature.
 */
function selectedOptionsByComponent(
  raw: RawCharacter,
  resolvePlaceholders: PlaceholderResolver,
): Map<number, { id?: number; name: string; summary?: string }[]> {
  const map = new Map<number, { id?: number; name: string; summary?: string }[]>();
  const classLevelByComponent = classLevelsByComponent(raw);
  const options = raw.options;
  if (!options) return map;
  const groups = [options.race, options.class, options.feat, options.background, options.item];
  for (const group of groups) {
    for (const option of asArray(group)) {
      const def = option.definition;
      const id = option.componentId;
      if (id == null || !def?.name || !def.snippet?.trim()) continue;
      const selected = {
        id: def.id,
        name: def.name,
        summary: summarize(
          def.snippet || def.description,
          400,
          (text) =>
            resolvePlaceholders(text, {
              classLevel:
                def.id == null ? undefined : classLevelByComponent.get(def.id),
            }),
        ),
      };
      const choices = map.get(id);
      if (choices) {
        if (!choices.some((choice) => choice.name === selected.name)) choices.push(selected);
      } else {
        map.set(id, [selected]);
      }
    }
  }
  return map;
}

interface HtmlBlock {
  html: string;
  start: number;
  end: number;
}

/** Extract balanced DIV blocks whose class list identifies a stat block. */
function statBlockHtml(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  const opening = /<div\b[^>]*class=["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = opening.exec(html))) {
    const classes = match[1].split(/\s+/);
    if (!classes.some((name) => name === 'stat-block' || name === 'stat-block-finder')) continue;
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = match.index;
    let depth = 0;
    let tag: RegExpExecArray | null;
    while ((tag = tags.exec(html))) {
      depth += /^<\/div/i.test(tag[0]) ? -1 : 1;
      if (depth === 0) {
        blocks.push({
          html: html.slice(match.index, tags.lastIndex),
          start: match.index,
          end: tags.lastIndex,
        });
        opening.lastIndex = tags.lastIndex;
        break;
      }
    }
  }
  return blocks;
}

function removeHtmlBlocks(html: string, blocks: HtmlBlock[]): string {
  let result = html;
  for (const block of [...blocks].sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, block.start)} ${result.slice(block.end)}`;
  }
  return result;
}

/** Remove stat blocks represented on the Companion card while preserving the surrounding rules. */
function withoutCompanionStatBlocks(
  html: string | null | undefined,
  source: string,
): string | null | undefined {
  if (!html) return html;
  const companions = statBlockHtml(html).filter((block) => parseCompanion(block.html, source));
  return removeHtmlBlocks(html, companions);
}

function hasCompanionStatBlock(
  html: string | null | undefined,
  source: string,
): boolean {
  return Boolean(
    html && statBlockHtml(html).some((block) => parseCompanion(block.html, source) != null),
  );
}

function leadingLabel(inner: string): { label: string; rest: string } | undefined {
  const nested = inner.match(
    /^\s*<(strong|b|em|i)\b[^>]*>\s*<(strong|b|em|i)\b[^>]*>(.+?)<\/\2>\s*<\/\1>\s*/i,
  );
  const openEmphasis = inner.match(
    /^\s*<(em|i)\b[^>]*>\s*<(strong|b)\b[^>]*>(.+?)<\/\2>\s*/i,
  );
  const marker =
    nested && [nested[1], nested[2]].some((tag) => /^(?:strong|b)$/i.test(tag))
      ? nested
      : openEmphasis ?? inner.match(/^\s*<(strong|b)\b[^>]*>(.+?)<\/\1>\s*/i);
  if (!marker) return undefined;
  const labelHtml = marker.length >= 4 ? marker[3] : marker[2];
  const label = plainText(labelHtml).replace(/[.:]\s*$/, '').trim();
  return label ? { label, rest: plainText(inner.slice(marker[0].length)) } : undefined;
}

function parseCompanion(block: string, source: string): CompanionEntry | undefined {
  const title =
    /<p\b[^>]*class=["'][^"']*(?:Stat-Block-Title)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1] ??
    /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(block)?.[1];
  const name = plainText(title ?? '');
  if (!name) return undefined;

  const paragraphs = [...block.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)].map(
    (match) => ({ attrs: match[1], inner: match[2], text: plainText(match[2]) }),
  );
  const metaParagraph = paragraphs.find((paragraph) =>
    /Stat-Block-Metadata/i.test(paragraph.attrs),
  );
  const meta =
    metaParagraph?.text ??
    paragraphs.find(
      (paragraph) =>
        paragraph.text !== name &&
        !/<strong\b/i.test(paragraph.inner) &&
        !/monster-header|Stat-Block-(?:Data|Body|Heading)/i.test(paragraph.attrs),
    )?.text;

  const basic = new Map<string, string>();
  const details: CompanionEntry['details'] = [];
  let section = 'Details';
  for (const paragraph of paragraphs) {
    if (paragraph.text === name || paragraph === metaParagraph || paragraph.text === meta) continue;
    if (/monster-header|Stat-Block-Heading/i.test(paragraph.attrs)) {
      section = paragraph.text;
      continue;
    }
    const labeled = leadingLabel(paragraph.inner);
    if (labeled) {
      const key = labeled.label.toLowerCase();
      if (key === 'ac' || key === 'armor class') basic.set('armorClass', labeled.rest);
      else if (key === 'hp' || key === 'hit points') basic.set('hitPoints', labeled.rest);
      else if (key === 'speed') basic.set('speed', labeled.rest);
      else if (key === 'challenge' || key === 'challenge rating' || key === 'cr') {
        basic.set('challengeRating', labeled.rest);
      } else {
        details.push({
          section: /resistances|immunities|vulnerabilities|senses|languages|challenge|^cr$/i.test(
            labeled.label,
          )
            ? 'Statistics'
            : section,
          label: labeled.label,
          text: labeled.rest,
        });
      }
    } else if (paragraph.text) {
      details.push({ section, label: '', text: paragraph.text });
    }
  }

  const abilities: CompanionEntry['abilities'] = [];
  for (const row of block.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(
      (cell) => plainText(cell[1]),
    );
    if (/^(STR|DEX|CON|INT|WIS|CHA)$/.test(cells[0] ?? '') && cells[1]) {
      abilities.push({
        key: cells[0],
        score: cells[1],
        ...(cells[2] ? { modifier: cells[2] } : {}),
        ...(cells[3] ? { save: cells[3] } : {}),
      });
    }
  }
  if (!abilities.length) {
    const legacy =
      /stat-block-ability-scores-heading["'][^>]*>(STR|DEX|CON|INT|WIS|CHA)<\/div>[\s\S]*?stat-block-ability-scores-score["'][^>]*>([^<]+)<\/span>[\s\S]*?stat-block-ability-scores-modifier["'][^>]*>([^<]+)<\/span>/gi;
    for (const match of block.matchAll(legacy)) {
      abilities.push({ key: match[1], score: plainText(match[2]), modifier: plainText(match[3]) });
    }
  }

  return {
    name,
    source,
    ...(meta ? { meta } : {}),
    ...(basic.get('challengeRating') ? { challengeRating: basic.get('challengeRating') } : {}),
    ...(basic.get('armorClass') ? { armorClass: basic.get('armorClass') } : {}),
    ...(basic.get('hitPoints') ? { hitPoints: basic.get('hitPoints') } : {}),
    ...(basic.get('speed') ? { speed: basic.get('speed') } : {}),
    abilities,
    details,
  };
}

function parseRollTables(html: string, source: string): RuleTable[] {
  const withoutStatBlocks = removeHtmlBlocks(html, statBlockHtml(html));
  const tables: RuleTable[] = [];
  for (const match of withoutStatBlocks.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const table = match[0];
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) => ({
        header: cell[1].toLowerCase() === 'th',
        text: plainText(cell[2]),
      })),
    );
    const headerRow = rows.find((row) => row.some((cell) => cell.header));
    const columns = (headerRow ?? []).map((cell) => cell.text);
    const firstColumn = (columns[0] ?? '').replace(/\s+/g, '');
    if (!/^(?:\d*d\d+|roll)$/i.test(firstColumn)) continue;
    const dataRows = rows
      .filter((row) => row !== headerRow && row.some((cell) => !cell.header))
      .map((row) => row.map((cell) => cell.text))
      .filter((row) => row.some(Boolean));
    if (!dataRows.length) continue;

    const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(table)?.[1];
    const prefix = withoutStatBlocks.slice(0, match.index ?? 0);
    const precedingHeading = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>\s*$/i.exec(prefix)?.[1];
    tables.push({
      title: plainText(caption ?? precedingHeading ?? source) || source,
      source,
      columns,
      rows: dataRows,
    });
  }
  return tables;
}

interface FeatureLookup {
  title: string;
  columns: [string, string];
  rows: [string, string][];
}

/** Compact two-column lookup tables whose caption names a feature part. These
 * are actionable option lists rather than progression tables; they stay inside
 * that part instead of becoming a separate Tables card. */
function parseFeatureLookups(html: string): FeatureLookup[] {
  const lookups: FeatureLookup[] = [];
  for (const match of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const table = match[0];
    const caption = plainText(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(table)?.[1] ?? '');
    if (!caption) continue;
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) => ({
        header: cell[1].toLowerCase() === 'th',
        text: plainText(cell[2]),
      })),
    );
    const header = rows.find((row) => row.some((cell) => cell.header));
    if (!header || header.length !== 2) continue;
    const data = rows
      .filter((row) => row !== header && row.length === 2 && row.some((cell) => !cell.header))
      .map((row) => [row[0].text, row[1].text] as [string, string])
      .filter((row) => row.every(Boolean));
    if (!data.length) continue;
    lookups.push({
      title: caption,
      columns: [header[0].text, header[1].text],
      rows: data,
    });
  }
  return lookups;
}

function withoutNamedTableReference(text: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(new RegExp(`\\s+(?:from|using)\\s+the\\s+${escaped}\\s+table\\b`, 'gi'), '')
    .replace(/\s+([.!?,;])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RuleSource {
  id?: number;
  name: string;
  html: string;
  classLevel?: number;
  kind: 'feature' | 'spell';
}

function activeRuleSources(raw: RawCharacter): RuleSource[] {
  const sources: RuleSource[] = [];
  const seen = new Set<string>();
  const add = (
    id: number | undefined,
    name: string | null | undefined,
    html: string | null | undefined,
    classLevel?: number,
    kind: RuleSource['kind'] = 'feature',
  ) => {
    if (!name || !html) return;
    const key = id == null ? `${name}|${html}` : String(id);
    if (seen.has(key)) return;
    seen.add(key);
    sources.push({ id, name, html, classLevel, kind });
  };
  for (const cls of asArray(raw.classes)) {
    const grants = asArray(cls.classFeatures).filter(
      (feature) =>
        feature.definition?.hideInSheet !== true &&
        (feature.definition?.requiredLevel == null || feature.definition.requiredLevel <= cls.level),
    );
    for (const grant of grants) {
      const def = grant.definition;
      add(def?.id, def?.name, def?.description || def?.snippet, cls.level);
    }
    const grantedIds = new Set(grants.map((grant) => grant.definition?.id));
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (
        feature.hideInSheet !== true &&
        !grantedIds.has(feature.id) &&
        (feature.requiredLevel == null || feature.requiredLevel <= cls.level)
      ) {
        add(feature.id, feature.name, feature.description || feature.snippet, cls.level);
      }
    }
  }
  for (const trait of asArray(raw.race?.racialTraits)) {
    const def = trait.definition;
    if (def?.hideInSheet !== true) add(def?.id, def?.name, def?.description || def?.snippet);
  }
  for (const feat of asArray(raw.feats)) {
    if (feat.definition?.hideInSheet !== true && !isDisguiseFeat(feat)) {
      const def = feat.definition;
      add(def?.id, def?.name, def?.description || def?.snippet);
    }
  }
  if (raw.options) {
    const groups = [raw.options.race, raw.options.class, raw.options.feat, raw.options.background, raw.options.item];
    const levels = classLevelsByComponent(raw);
    for (const group of groups) {
      for (const option of asArray(group)) {
        const def = option.definition;
        add(
          def?.id,
          def?.name,
          def?.description || def?.snippet,
          def?.id == null ? undefined : levels.get(def.id),
        );
      }
    }
  }
  // Summoning spells publish their companion stat blocks inside the active
  // spell definition rather than a class/feat feature (e.g. Summon Beast).
  // Leave the source id unset so the block does not claim an unrelated feature
  // with a coincidentally matching numeric id.
  const addSpell = (spell: RawSpell) => {
    const def = spell.definition;
    add(undefined, def?.name, def?.description || def?.snippet, undefined, 'spell');
  };
  for (const group of asArray(raw.classSpells)) asArray(group.spells).forEach(addSpell);
  if (raw.spells) {
    for (const group of Object.values(raw.spells)) asArray<RawSpell>(group).forEach(addSpell);
  }
  return sources;
}

interface CreatureFeatureSource {
  id?: number;
  name: string;
}

function creatureFeatureRank(name: string): number {
  if (/ability score improvement/i.test(name)) return 1000;
  if (/^\d+\s*:/.test(name)) return 500;
  if (/improvement/i.test(name)) return 100;
  if (/^wild shape$/i.test(name)) return 0;
  if (/circle forms/i.test(name)) return 20;
  return 10;
}

/** Owning feature for each D&D Beyond Extras creature group. */
function creatureFeatureSources(raw: RawCharacter): Map<number, CreatureFeatureSource> {
  const candidates = new Map<number, CreatureFeatureSource[]>();
  const add = (
    definition:
      | {
          id?: number;
          name?: string;
          requiredLevel?: number;
          creatureRules?: { creatureGroupId?: number | null }[] | null;
        }
      | null
      | undefined,
    classLevel: number,
  ) => {
    if (
      !definition?.name ||
      (definition.requiredLevel != null && definition.requiredLevel > classLevel)
    ) {
      return;
    }
    for (const rule of asArray(definition.creatureRules)) {
      if (rule.creatureGroupId == null) continue;
      const sources = candidates.get(rule.creatureGroupId) ?? [];
      sources.push({ id: definition.id, name: definition.name });
      candidates.set(rule.creatureGroupId, sources);
    }
  };
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.classFeatures)) add(feature.definition, cls.level);
    for (const feature of asArray(cls.definition?.classFeatures)) add(feature, cls.level);
  }
  return new Map(
    [...candidates].map(([groupId, sources]) => [
      groupId,
      [...sources].sort(
        (left, right) =>
          creatureFeatureRank(left.name) - creatureFeatureRank(right.name) ||
          left.name.length - right.name.length,
      )[0],
    ]),
  );
}

const CREATURE_ALIGNMENTS: Readonly<Record<number, string>> = {
  1: 'Lawful Good',
  2: 'Neutral Good',
  3: 'Chaotic Good',
  4: 'Lawful Neutral',
  5: 'Neutral',
  6: 'Chaotic Neutral',
  7: 'Lawful Evil',
  8: 'Neutral Evil',
  9: 'Chaotic Evil',
  10: 'Unaligned',
};

const CREATURE_MOVEMENTS: Readonly<Record<number, string>> = {
  1: '',
  2: 'Burrow',
  3: 'Climb',
  4: 'Fly',
  5: 'Swim',
};

function signedNumber(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function creatureChallengeRating(id: number | null | undefined): string | undefined {
  if (id == null) return undefined;
  if (id === 1) return '0';
  if (id === 2) return '1/8';
  if (id === 3) return '1/4';
  if (id === 4) return '1/2';
  return id >= 5 ? String(id - 4) : undefined;
}

function creatureDetails(
  details: CompanionEntry['details'],
  html: string | null | undefined,
  section: string,
): void {
  if (!html) return;
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  if (!paragraphs.length) {
    const text = plainText(html);
    if (text) details.push({ section, label: '', text });
    return;
  }
  for (const paragraph of paragraphs) {
    const labeled = leadingLabel(paragraph[1]);
    if (labeled) details.push({ section, label: labeled.label, text: labeled.rest });
    else {
      const text = plainText(paragraph[1]);
      if (text) details.push({ section, label: '', text });
    }
  }
}

function parseSelectedCreature(
  creature: RawCreature,
  source: string,
): CompanionEntry | undefined {
  const definition = creature.definition;
  const name = creature.name?.trim() || definition?.name?.trim();
  if (!definition || !name) return undefined;

  const size = definition.sizeId == null ? undefined : CREATURE_SIZES[definition.sizeId];
  const type = definition.typeId == null ? undefined : CREATURE_TYPES[definition.typeId];
  const alignment =
    definition.alignmentId == null ? undefined : CREATURE_ALIGNMENTS[definition.alignmentId];
  const creatureKind = [size, type].filter(Boolean).join(' ');
  const meta = `${creatureKind}${alignment ? `${creatureKind ? ', ' : ''}${alignment}` : ''}`;
  const speeds = asArray(definition.movements).flatMap((movement) => {
    if (movement.speed == null || movement.speed <= 0) return [];
    const label = CREATURE_MOVEMENTS[movement.movementId ?? 0];
    return [`${label ? `${label} ` : ''}${movement.speed} ft.${movement.notes ? ` ${movement.notes}` : ''}`];
  });
  const hitPointDice = definition.hitPointDice?.diceString?.trim();
  const hitPoints =
    definition.averageHitPoints == null
      ? undefined
      : `${definition.averageHitPoints}${hitPointDice ? ` (${hitPointDice})` : ''}`;
  const saves = new Map(
    asArray(definition.savingThrows).flatMap((save) =>
      save.statId == null || (save.bonus ?? save.value) == null
        ? []
        : [[save.statId, save.bonus ?? save.value!] as const],
    ),
  );
  const abilities: CompanionEntry['abilities'] = asArray(definition.stats).flatMap((stat) => {
    if (stat.statId == null || stat.value == null) return [];
    const ability = ABILITIES.find((entry) => entry.id === stat.statId);
    if (!ability) return [];
    const save = saves.get(stat.statId);
    return [{
      key: ability.key.toUpperCase(),
      score: String(stat.value),
      modifier: signedNumber(abilityModifier(stat.value)),
      ...(save == null ? {} : { save: signedNumber(save) }),
    }];
  });

  const details: CompanionEntry['details'] = [];
  if (creature.description?.trim()) {
    details.push({ section: 'Details', label: '', text: plainText(creature.description) });
  }
  creatureDetails(details, definition.specialTraitsDescription, 'Traits');
  creatureDetails(details, definition.actionsDescription, 'Actions');
  creatureDetails(details, definition.bonusActionsDescription, 'Bonus Actions');
  creatureDetails(details, definition.reactionsDescription, 'Reactions');
  creatureDetails(details, definition.legendaryActionsDescription, 'Legendary Actions');
  creatureDetails(details, definition.mythicActionsDescription, 'Mythic Actions');
  creatureDetails(details, definition.characteristicsDescription, 'Characteristics');
  const language = plainText(
    [definition.languageDescription, definition.languageNote].filter(Boolean).join(' '),
  );
  if (language) details.unshift({ section: 'Statistics', label: 'Languages', text: language });
  if (definition.passivePerception != null) {
    details.unshift({
      section: 'Statistics',
      label: 'Senses',
      text: `Passive Perception ${definition.passivePerception}`,
    });
  }

  return {
    name,
    source,
    ...(meta ? { meta } : {}),
    ...(creatureChallengeRating(definition.challengeRatingId)
      ? { challengeRating: creatureChallengeRating(definition.challengeRatingId) }
      : {}),
    ...(definition.armorClass == null
      ? {}
      : {
          armorClass: `${definition.armorClass}${definition.armorClassDescription?.trim() ? ` ${definition.armorClassDescription.trim()}` : ''}`,
        }),
    ...(hitPoints ? { hitPoints } : {}),
    ...(speeds.length ? { speed: speeds.join('; ') } : {}),
    abilities,
    details,
  };
}

function companionCategory(source: string, kind: RuleSource['kind'] | 'extra'): string {
  if (kind === 'spell') return 'Summons';
  if (/wild shape/i.test(source)) return 'Wild Shapes';
  if (/familiar|wild companion/i.test(source)) return 'Familiars';
  if (/(?:beast|primal|ranger'?s?).*companion|companion.*beast/i.test(source)) {
    return 'Beast Companions';
  }
  if (/companion|defender/i.test(source)) return 'Companions';
  return kind === 'extra' ? 'Extras' : 'Companions';
}

interface ExtraCreatureFallback {
  name: string;
  category: string;
  rank: number;
}

function fallbackExtraCreatureSource(sources: RuleSource[]): ExtraCreatureFallback | undefined {
  const candidates = sources.flatMap((source): ExtraCreatureFallback[] => {
    const name = source.name;
    const text = `${name} ${plainText(source.html)}`;
    if (/^find familiar$/i.test(name)) return [{ name, category: 'Familiars', rank: 0 }];
    if (/familiar|wild companion/i.test(name)) {
      return [{ name, category: 'Familiars', rank: 1 }];
    }
    if (/find familiar/i.test(text)) return [{ name, category: 'Familiars', rank: 2 }];
    if (/(?:beast|primal|ranger'?s?).*companion|companion.*beast/i.test(text)) {
      return [{ name, category: 'Beast Companions', rank: 3 }];
    }
    if (/companion|defender/i.test(name)) {
      return [{ name, category: 'Companions', rank: 4 }];
    }
    return [];
  });
  if (!candidates.length) return undefined;
  const categories = new Set(candidates.map((candidate) => candidate.category));
  if (categories.size !== 1) return undefined;
  return candidates.sort((left, right) => left.rank - right.rank || left.name.length - right.name.length)[0];
}

function companionSectionTitle(categories: Set<string>): string {
  const priority = ['Summons', 'Wild Shapes', 'Familiars', 'Beast Companions', 'Companions', 'Extras'];
  const titles = [...categories].sort((left, right) => priority.indexOf(left) - priority.indexOf(right));
  if (!titles.length) return 'Companions';
  if (titles.length <= 2) return titles.join(' & ');
  return 'Creatures';
}

function resolveRuleArtifacts(
  raw: RawCharacter,
  resolvePlaceholders: PlaceholderResolver,
): {
  companions: CompanionEntry[];
  companionTitle: string;
  ruleTables: RuleTable[];
  companionFeatureIds: Set<number>;
  tableFeatureIds: Set<number>;
} {
  const companions: CompanionEntry[] = [];
  const ruleTables: RuleTable[] = [];
  const companionFeatureIds = new Set<number>();
  const companionCategories = new Set<string>();
  const tableFeatureIds = new Set<number>();
  const companionKeys = new Set<string>();
  const tableKeys = new Set<string>();
  const ruleSources = activeRuleSources(raw);
  for (const source of ruleSources) {
    const html = resolvePlaceholders(source.html, { classLevel: source.classLevel });
    for (const block of statBlockHtml(html)) {
      const companion = parseCompanion(block.html, source.name);
      if (!companion) continue;
      const key = `${source.name}|${companion.name}`;
      if (companionKeys.has(key)) continue;
      companionKeys.add(key);
      companions.push(companion);
      companionCategories.add(companionCategory(source.name, source.kind));
      if (source.id != null) companionFeatureIds.add(source.id);
    }
    for (const table of parseRollTables(html, source.name)) {
      const key = `${source.name}|${table.title}|${JSON.stringify(table.rows)}`;
      if (tableKeys.has(key)) continue;
      tableKeys.add(key);
      ruleTables.push(table);
      if (source.id != null) tableFeatureIds.add(source.id);
    }
  }
  const featureSources = creatureFeatureSources(raw);
  const fallbackSource = fallbackExtraCreatureSource(ruleSources);
  for (const creature of asArray(raw.creatures)) {
    const owner = creature.groupId == null ? undefined : featureSources.get(creature.groupId);
    const source = owner?.name ?? fallbackSource?.name ?? 'Extra';
    const companion = parseSelectedCreature(creature, source);
    if (!companion) continue;
    const key = `${source}|${companion.name}`;
    if (companionKeys.has(key)) continue;
    companionKeys.add(key);
    companions.push(companion);
    companionCategories.add(
      owner
        ? companionCategory(source, 'extra')
        : fallbackSource?.category ?? companionCategory(source, 'extra'),
    );
    if (owner?.id != null) companionFeatureIds.add(owner.id);
  }
  return {
    companions,
    companionTitle: companionSectionTitle(companionCategories),
    ruleTables,
    companionFeatureIds,
    tableFeatureIds,
  };
}

/**
 * Split a feature's description into its intro (leading prose) and named
 * sub-parts. D&D Beyond marks each sub-part with a paragraph starting
 * `<strong><em>Name.</em></strong>`; paragraphs before the first marker are the
 * intro, and un-named paragraphs after the markers (e.g. Circle of Mortality's
 * healing rider) become trailing parts with an empty label. Returns no parts
 * when the feature has no sub-part markers.
 */
function parseFeatureParts(
  html: string | null | undefined,
  resolvePlaceholders?: (text: string) => string,
): {
  intro: string;
  parts: FeaturePart[];
} {
  const raw = html ?? '';
  const resolved = resolvePlaceholders ? resolvePlaceholders(raw) : raw;
  const lookups = parseFeatureLookups(resolved);
  // Tables are reference material rather than prose blocks. Remove them before
  // scanning so caption headings and cell paragraphs cannot masquerade as
  // feature parts.
  const source = removeHtmlBlocks(resolved, statBlockHtml(resolved))
    // Blockquotes are sidebars, generic rules tips, and builder instructions,
    // not character-specific mechanics.
    .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, ' ')
    // Some legacy content places a table title immediately before a wrapped
    // table rather than inside its caption. Remove both so the orphaned title
    // cannot become a heading for the paragraph after the table.
    .replace(
      /<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>\s*(?:<div\b[^>]*>\s*)?(?=<table\b)/gi,
      ' ',
    )
    .replace(/<table[\s\S]*?<\/table>/gi, ' ');
  const blocks = [...source.matchAll(/<(p|li|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(
    (match) => ({ tag: match[1].toLowerCase(), inner: match[2] }),
  );
  if (!blocks.length) {
    blocks.push(
      ...source
        .split(/\r?\n\s*\r?\n/)
        .filter((chunk) => chunk.trim())
        .map((inner) => ({ tag: 'p', inner })),
    );
  }
  const parts: FeaturePart[] = [];
  const introChunks: string[] = [];
  let seenPart = false;
  let pendingHeading = '';
  for (const block of blocks) {
    if (/^h[1-6]$/.test(block.tag)) {
      const heading = plainText(block.inner).replace(/[.:]\s*$/, '').trim();
      if (heading) {
        if (pendingHeading) parts.push({ label: pendingHeading, text: '' });
        pendingHeading = heading;
        seenPart = true;
      }
      continue;
    }

    const nestedMarker = block.inner.match(
      /^\s*<(strong|b|em|i)\b[^>]*>\s*<(strong|b|em|i)\b[^>]*>(.+?)<\/\2>\s*<\/\1>\s*/i,
    );
    const marker =
      nestedMarker &&
      [nestedMarker[1], nestedMarker[2]].some((tag) => /^(?:strong|b)$/i.test(tag))
        ? nestedMarker
        : block.inner.match(/^\s*<(strong|b)\b[^>]*>(.+?)<\/\1>\s*/i);
    if (marker) {
      seenPart = true;
      if (pendingHeading) {
        parts.push({ label: pendingHeading, text: '' });
        pendingHeading = '';
      }
      const labelHtml = marker.length >= 4 ? marker[3] : marker[2];
      const label = plainText(labelHtml).replace(/[.:]\s*$/, '').trim();
      if (label) parts.push({ label, text: plainText(block.inner.slice(marker[0].length)) });
    } else {
      const text = plainText(block.inner);
      if (!text) continue;
      if (pendingHeading) {
        parts.push({ label: pendingHeading, text });
        pendingHeading = '';
      } else if (block.tag === 'li') {
        seenPart = true;
        parts.push({ label: '', text: `• ${text}` });
      } else if (seenPart) parts.push({ label: '', text });
      else introChunks.push(text);
    }
  }
  if (pendingHeading) parts.push({ label: pendingHeading, text: '' });
  for (const part of parts) {
    const lookup = lookups.find(
      (entry) => entry.title.trim().toLowerCase() === part.label.trim().toLowerCase(),
    );
    if (!lookup) continue;
    part.text = withoutNamedTableReference(part.text, lookup.title);
    part.list = {
      label: lookup.columns[1],
      items: lookup.rows.map(([label, text]) => ({ label, text })),
    };
  }
  return { intro: introChunks.join(' '), parts };
}

/** Turn a spell description with multiple named/bulleted blocks into a real
 * list. Ordinary continuation paragraphs stay attached to the preceding named
 * item, while explicit list items remain separate bullets. */
function spellStructuredContent(
  html: string | null | undefined,
  resolvePlaceholders: (text: string) => string,
): { intro: string; list: StructuredList } | undefined {
  if (!html) return undefined;
  const { intro, parts } = parseFeatureParts(html, resolvePlaceholders);
  const namedCount = parts.filter((part) => part.label).length;
  const bulletCount = parts.filter((part) => /^•\s*/.test(part.text)).length;
  if (namedCount < 2 && bulletCount < 2) return undefined;

  const items: StructuredList['items'] = [];
  for (const part of parts) {
    if (part.label) {
      items.push({ label: part.label, text: part.text });
    } else if (/^•\s*/.test(part.text)) {
      items.push({ text: part.text.replace(/^•\s*/, '') });
    } else if (part.text && items.length) {
      items[items.length - 1].text = `${items[items.length - 1].text} ${part.text}`.trim();
    }
  }
  return items.length ? { intro, list: { items } } : undefined;
}

/**
 * Drop whole sentences that reference a rules TABLE (e.g. "as shown in the
 * Cleric Features table", "the spells outlined in the Elven Lineages table") —
 * the printed sheet doesn't include those tables, so the reference is dead
 * weight. Matches the WORD "table"/"tables" (so "Repeatable" is safe) and splits
 * on the same sentence boundary the summarizer respects (a ./!/? before a
 * capital or paren, so "120 ft." isn't treated as a break).
 */
function stripTableSentences(text: string): string {
  return text
    .replace(/([.!?])\s+(?=[A-Z(])/g, '$1\u0000')
    .split('\u0000')
    .filter((sentence) => !/\btables?\b/i.test(sentence))
    .join(' ')
    .trim();
}

/**
 * Remove just a "… in the <Name> table" REFERENCE CLAUSE from a sentence, keeping
 * the rest of it — unlike {@link stripTableSentences}, which drops the whole
 * sentence. Used as a fallback so a lone sentence that carries real info next to
 * a table pointer (e.g. "You gain the spells outlined in the Fiendish Legacies
 * table.") isn't lost entirely.
 */
function stripTableClause(text: string): string {
  return text
    .replace(
      /,?\s*(?:as\s+)?(?:shown|outlined|listed|described|detailed|found|noted|specified|presented|provided)\s+(?:in|on)\s+the\b[^.!?]*?\btables?\b/gi,
      '',
    )
    .replace(/\s+([.!?,;])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A table-stripped spell feature can be left saying "that spell" with no
 * antecedent. When its remaining rules are the prepared/free-cast pattern,
 * restate them against the concrete provenance list shown on the card. */
function repairGrantedSpellSummary(
  featureName: string,
  summary: string,
  grantedSpells: string[] | undefined,
): string {
  if (
    !grantedSpells?.length ||
    !/^You always have that spell prepared\. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest\. You can also cast the spell using any spell slots you have of the appropriate level\.$/i.test(
      summary,
    )
  ) {
    return summary;
  }
  const origin = featureName.replace(/\s+Spells?$/i, '').trim();
  const subject = origin !== featureName ? `Your ${origin}` : 'This feature';
  return (
    `${subject} grants the spells listed below. You always have them prepared. ` +
    'Each leveled spell can be cast once without a spell slot, and you regain that ' +
    'casting after a Long Rest. You can also cast it using an appropriate spell slot.'
  );
}

/**
 * Drop the boilerplate repeatability note D&D Beyond appends to repeatable feats
 * ("Repeatable. You can take this feat more than once.") — it's noise on a
 * filled sheet where the feat has already been taken.
 */
function stripRepeatableNote(text: string): string {
  return text
    .replace(
      /\*\*\s*repeatable\.?\s*\*\*\s*you can take this feat more than once\.?/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

interface FeatureContent {
  summary?: string;
  grants?: { label: string; items: string[] }[];
  reference?: SectionKey;
  related?: SectionKey[];
  parts?: FeaturePart[];
}

function structuredFeatureBenefits(
  text: string | null | undefined,
  resolvePlaceholders: (text: string) => string,
): FeatureContent | undefined {
  if (!text || !/following benefits/i.test(text) || !text.includes('•')) return undefined;
  const chunks = plainText(resolvePlaceholders(text))
    .split(/\s*•\s*/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunks.length < 3) return undefined;
  const [summary, ...benefits] = chunks;
  return {
    summary,
    parts: [
      {
        label: '',
        text: '',
        list: { items: benefits.map((benefit) => ({ text: benefit })) },
      },
    ],
  };
}

/** Features and traits grouped by source, each with its resource + sub-parts. */
function resolveFeatures(
  raw: RawCharacter,
  resources: Map<number, ResourcePool>,
  actionReferencesByComponent: Map<number, ActionReference[]>,
  companionFeatureIds: Set<number>,
  tableFeatureIds: Set<number>,
  spellNamesByComponent: Map<number, string[]>,
  resolvePlaceholders: PlaceholderResolver,
): FeatureGroup[] {
  const optionByComponent = selectedOptionsByComponent(raw, resolvePlaceholders);
  const featIds = new Set(
    asArray(raw.feats).flatMap((feat) =>
      feat.definition?.id == null ? [] : [feat.definition.id],
    ),
  );

  // The same feature can appear through a class template and a granted feature
  // with different ids. Group exact-name duplicates so either id can find the
  // other's action without allowing unrelated components to collapse it.
  const featureIdsByName = new Map<string, Set<number>>();
  const noteFeature = (definition: { id?: number; name?: string | null } | null | undefined) => {
    if (definition?.id == null || !definition.name) return;
    const key = definition.name.trim().toLowerCase();
    const ids = featureIdsByName.get(key);
    if (ids) ids.add(definition.id);
    else featureIdsByName.set(key, new Set([definition.id]));
  };
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) noteFeature(feature);
    for (const feature of asArray(cls.classFeatures)) noteFeature(feature.definition);
  }
  for (const trait of asArray(raw.race?.racialTraits)) noteFeature(trait.definition);
  for (const feat of asArray(raw.feats)) noteFeature(feat.definition);

  // A sub-part is detailed on the Actions card when the feature's grantor id has
  // an action that corresponds to it (e.g. Circle of Mortality -> "Pull of Death",
  // or Font of Magic -> its "Create Spell Slot Level 1" action); then the feature
  // just points to the Actions card instead of repeating its text. The match is
  // loose — significant, crudely-stemmed words (dropping any "Feature: " prefix
  // and stopwords), so gerund/qualifier wording still lines up ("Creating Spell
  // Slots" <-> "Create Spell Slot Level 1"). A sub-part matches an action when
  // they share their leading word and one name's words are a subset of the other's.
  const matchStopwords = new Set([
    'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on',
    'or', 'the', 'this', 'to', 'with', 'your',
  ]);
  const significantWords = (text: string): string[] => {
    const body = text.includes(': ') ? text.slice(text.indexOf(': ') + 2) : text;
    return body
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word && !matchStopwords.has(word) && !/^\d+$/.test(word))
      .map((word) => word.replace(/ing$/, '').replace(/es$/, '').replace(/s$/, '').replace(/e$/, ''));
  };
  // Two names "match" when they share their leading significant word and one's
  // words are a subset of the other's (so "Creating Spell Slots" lines up with
  // "Create Spell Slot Level 1", and the "Innate Sorcery" feature with its action).
  const wordsSubsetMatch = (a: string[], b: string[]): boolean => {
    if (a.length < 2 || b.length < 2 || a[0] !== b[0]) return false;
    const aSet = new Set(a);
    const bSet = new Set(b);
    const [small, large] = aSet.size <= bSet.size ? [aSet, bSet] : [bSet, aSet];
    return [...small].every((word) => large.has(word));
  };
  const isActionPart = (id: number | undefined, label: string): boolean => {
    if (id == null) return false;
    const labelWords = significantWords(label);
    const componentIds = [
      id,
      ...(optionByComponent.get(id) ?? [])
        .map((option) => option.id)
        .filter((optionId): optionId is number => optionId != null),
    ];
    return componentIds.some((componentId) =>
      actionReferencesByComponent.get(componentId)?.some(
        (reference) =>
          reference.hasDetail &&
          wordsSubsetMatch(labelWords, significantWords(reference.name)),
      ),
    );
  };
  // Whole features whose own substantive activations live on the Actions card
  // point there instead of repeating them. Passive "other" options keep their
  // feature text.
  const isDetailedActionFeature = (id: number | undefined, name: string): boolean => {
    const ids = new Set<number>();
    if (id != null) ids.add(id);
    for (const duplicateId of featureIdsByName.get(name.trim().toLowerCase()) ?? []) {
      ids.add(duplicateId);
    }
    const featureWords = significantWords(name);
    return [...ids].some((componentId) =>
      actionReferencesByComponent.get(componentId)?.some(
        (reference) =>
          reference.hasDetail &&
          reference.isActivation &&
          wordsSubsetMatch(featureWords, significantWords(reference.name)),
      ),
    );
  };

  // A feature's display content: a summary blurb plus optional named sub-parts.
  const contentFor = (
    id: number | undefined,
    snippet: string | null | undefined,
    description: string | null | undefined,
    featureResolver: (text: string) => string = resolvePlaceholders,
  ): FeatureContent => {
    const structuredBenefits = structuredFeatureBenefits(snippet, featureResolver);
    if (structuredBenefits) return structuredBenefits;
    const { intro, parts } = parseFeatureParts(description || snippet, featureResolver);
    if (parts.length === 0) {
      const summary = summarize(snippet || intro || description, 400, featureResolver);
      return summary ? { summary } : {};
    }
    const shown: FeaturePart[] = [];
    for (const part of parts) {
      if (part.label && isActionPart(id, part.label)) {
        shown.push({ label: part.label, text: '', reference: 'actions' });
      } else if (
        !part.label &&
        shown[shown.length - 1]?.reference === 'actions'
      ) {
        // An unlabeled rider right after an action-pointed sub-part only
        // elaborates on that action (e.g. Divine Spark's damage scaling); the
        // detail already lives on the Actions card, so drop it as redundant.
        continue;
      } else {
        shown.push(part);
      }
    }
    return intro ? { summary: intro, parts: shown } : { parts: shown };
  };

  const toItem = (
    name: string,
    id: number | undefined,
    content: FeatureContent,
  ): FeatureItem => {
    const item: FeatureItem = { name };
    const resource = id != null ? resources.get(id) : undefined;
    if (resource) item.resource = resource;
    const grantedSpells = id != null ? spellNamesByComponent.get(id) : undefined;
    if (grantedSpells?.length) item.grantedSpells = grantedSpells;
    if (content.grants?.length) item.grants = content.grants;
    // Drop table references (the printed sheet has no rules tables) and the
    // "Repeatable — you can take this feat more than once" boilerplate.
    let summary = content.summary
      ? stripRepeatableNote(stripTableSentences(content.summary))
      : '';
    // If dropping table-reference sentences removed EVERYTHING, the lone sentence
    // carried real info beside a table pointer — trim just the pointer instead of
    // showing nothing.
    if (!summary && content.summary) {
      summary = stripRepeatableNote(stripTableClause(content.summary));
    }
    summary = repairGrantedSpellSummary(name, summary, grantedSpells);
    if (summary) item.summary = summary;
    if (content.reference) item.reference = content.reference;
    if (content.related?.length) item.related = content.related;
    if (content.parts?.length) {
      const parts = content.parts
        .map((part) => ({ ...part, text: stripTableSentences(part.text) }))
        .filter((part) => part.label || part.text || part.reference || part.list?.items.length)
        .filter(
          (part) =>
            !/^\s*repeatable\b/i.test(part.label ?? '') &&
            !/take this feat more than once/i.test(part.text ?? ''),
        );
      if (parts.length) item.parts = parts;
    }
    return item;
  };

  // Resolve a feature's displayed name + content, applying the choice-base
  // option replacement (Elven Lineage -> Drow Lineage) — which supplies its own
  // blurb and no sub-parts.
  const resolve = (
    id: number | undefined,
    rawName: string | undefined,
    snippet: string | null | undefined,
    description: string | null | undefined,
    context: PlaceholderContext = {},
  ): { name: string | undefined; content: FeatureContent } => {
    // A feature whose whole purpose is a stat bump (the Ability Score Improvement
    // feat, a background's Ability Score Increase(s)): show ONLY concrete bumps.
    // A builder prompt that produced no modifiers adds nothing beyond the final
    // scores already printed on the Attributes card, so omit it.
    if (rawName && ABILITY_SCORE_FEATURE.test(rawName)) {
      const only = abilityScoreIncreases(raw, id);
      if (only) return { name: rawName, content: { summary: only } };
      return { name: undefined, content: {} };
    }

    let name = rawName;
    let content: FeatureContent;
    const isFeat = id != null && featIds.has(id);
    const featureResolver = (text: string) => resolvePlaceholders(text, context);
    const choices = id != null ? optionByComponent.get(id) : undefined;
    if (choices?.length === 1) {
      const [chosen] = choices;
      // Parameter choices retain the owning feature's identity: e.g.
      // "Otherworldly Presence (Charisma)" or "Elemental Affinity (Fire)".
      const qualifier = choiceQualifier(chosen.name);
      const activationTarget = chosen.name.replace(
        /^(?:activate|enter|invoke|start|use)\s+/i,
        '',
      );
      const isActivationAlias =
        rawName != null &&
        activationTarget !== chosen.name &&
        activationTarget.toLowerCase() === rawName.toLowerCase();
      name = qualifier && rawName
        ? `${rawName} (${qualifier})`
        : isActivationAlias
          ? rawName
          : chosen.name;
      content = chosen.summary ? { summary: chosen.summary } : {};
    } else if (choices?.length) {
      // Multi-choice systems (Metamagic options, Eldritch Invocations,
      // artificer plans, etc.) are one owning feature with every selected
      // option listed beneath it. Never discard all but the first selection.
      content = {
        parts: choices.map((choice) => ({
          label: choice.name,
          text: isActionPart(id, choice.name) ? '' : (choice.summary ?? ''),
          ...(isActionPart(id, choice.name) ? { reference: 'actions' as const } : {}),
        })),
      };
    } else {
      content = contentFor(
        id,
        snippet,
        isFeat ? stripFeatMetadata(description) : description,
        featureResolver,
      );
      // Spellcasting/Pact Magic is fully owned by the Spells card: stats, slots,
      // focus, and spell rows all live there rather than repeating progression rules.
      if (rawName && SPELLCASTING_FEATURE.test(rawName)) {
        const summary = firstFeatureSentence(description || snippet, featureResolver);
        content = summary ? { summary } : {};
      }
    }

    // A feat that grants proficiencies (Skilled and the like) shows the actual
    // skills/tools chosen, not the generic "any combination of your choice" text.
    const proficiencies = featureProficiencies(raw, id);
    const selfNamedProficiency =
      rawName != null &&
      proficiencies?.text.trim().toLowerCase() === rawName.trim().toLowerCase();
    if (proficiencies) {
      const proficiencyPartIndex = content.parts?.findIndex((part) =>
        /^(?:Tool |Skill )?Proficienc(?:y|ies)$/i.test(part.label),
      ) ?? -1;
      if (proficiencyPartIndex >= 0) {
        const parts = [...content.parts!];
        parts[proficiencyPartIndex] = {
          ...parts[proficiencyPartIndex],
          text: proficiencies.text,
        };
        content = { ...content, parts };
      } else if (selfNamedProficiency) {
        content = { ...content, summary: undefined, grants: proficiencies.grants };
      } else {
        content = {
          ...content,
          summary: concreteProficiencySummary(
            rawName,
            proficiencies.text,
            description || snippet,
            featureResolver,
          ),
        };
      }
    }

    // Any OTHER feature that ALSO grants an ability-score bonus (a half-feat, an
    // origin's fixed increase, …): note the bumps alongside its description.
    const increases = abilityScoreIncreases(raw, id);
    const abilityPartIndex = content.parts?.findIndex((part) =>
      /^Ability Score Increase$/i.test(part.label),
    ) ?? -1;
    const selectedIncrease = isFeat && abilityPartIndex >= 0
      ? selectedFeatAbilityIncrease(raw, id, content.parts![abilityPartIndex].text)
      : undefined;
    const displayedIncrease = increases ?? selectedIncrease;
    if (isFeat && abilityPartIndex >= 0 && (displayedIncrease || selectedIncrease === null)) {
      const parts = [...content.parts!];
      parts[abilityPartIndex] = {
        ...parts[abilityPartIndex],
        text: displayedIncrease ?? 'Not selected in D&D Beyond',
      };
      content = { ...content, parts };
    } else if (displayedIncrease) {
      content = {
        ...content,
        parts: [{ label: '', text: displayedIncrease }, ...(content.parts ?? [])],
      };
    }

    const artifactIds = [
      ...(id == null ? [] : [id]),
      ...(choices ?? []).flatMap((choice) => (choice.id == null ? [] : [choice.id])),
    ];
    const related = new Set<SectionKey>([
      ...(content.related ?? []),
      ...(selfNamedProficiency ? [] : (proficiencies?.related ?? [])),
      ...modifierRelatedSections(raw, id),
    ]);
    if (artifactIds.some((artifactId) => companionFeatureIds.has(artifactId))) {
      related.add('companions');
    }
    if (artifactIds.some((artifactId) => tableFeatureIds.has(artifactId))) {
      related.add('tables');
    }
    if (related.size) content = { ...content, related: [...related] };

    // A pure save-advantage trait is fully represented in Saves & Defences.
    if (
      content.related?.length === 1 &&
      content.related[0] === 'savingThrows' &&
      !content.parts?.length &&
      /^You have (?:Advantage|Disadvantage) on saving throws\b/i.test(content.summary ?? '')
    ) {
      content = { related: content.related };
    }

    // A whole feature that is itself an Actions-card activation just points there
    // — its full text (benefits and all) lives on the action.
    const hasStructuredBenefits = content.parts?.some((part) => part.list?.items.length);
    if (name && !hasStructuredBenefits && isDetailedActionFeature(id, name)) {
      const related = content.related?.filter((section) => section !== 'companions');
      return {
        name,
        content: {
          reference: 'actions',
          ...(related?.length ? { related } : {}),
        },
      };
    }

    return { name, content };
  };

  const classItems: FeatureItem[] = [];
  const seen = new Set<string>();
  const addClass = (
    id: number | undefined,
    rawName: string | undefined,
    snippet: string | null | undefined,
    description: string | null | undefined,
    context: PlaceholderContext = {},
  ) => {
    // Skip a feature whose original name is already shown, so an option-renamed
    // grant (e.g. "Innate Sorcery" -> its "Activate Innate Sorcery" option) isn't
    // listed alongside the plain feature from the class template.
    if (rawName && seen.has(classFeatureDisplayName(rawName))) return;
    const { name, content } = resolve(id, rawName, snippet, description, context);
    if (!name || isStructuralClassFeature(name)) return;
    const displayName = classFeatureDisplayName(name);
    if (seen.has(displayName)) return;
    if (rawName) seen.add(classFeatureDisplayName(rawName));
    seen.add(displayName);
    classItems.push(toItem(displayName, id, content));
  };
  const contextForScale = (
    castingClass: string | undefined,
    classLevel: number,
    scale: RawLevelScale | null | undefined,
  ): PlaceholderContext => ({
    castingClass,
    classLevel,
    scaleValue: scale?.fixedValue ?? scale?.dice?.diceString ?? undefined,
  });
  for (const cls of asArray(raw.classes)) {
    const grants = asArray(cls.classFeatures).filter(
      (feature) =>
        feature.definition?.hideInSheet !== true &&
        (feature.definition?.requiredLevel == null || feature.definition.requiredLevel <= cls.level),
    );
    const usedGrants = new Set<(typeof grants)[number]>();

    // Keep canonical progression order, but use the character-bound grant's
    // dynamic snippet and active scale whenever a matching record exists.
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (
        feature.hideInSheet !== true &&
        (feature.requiredLevel == null || feature.requiredLevel <= cls.level)
      ) {
        const grant =
          grants.find((candidate) => candidate.definition?.id === feature.id) ??
          grants.find((candidate) => candidate.definition?.name === feature.name);
        if (grant) {
          usedGrants.add(grant);
          const def = grant.definition;
          addClass(
            def?.id,
            feature.name ?? def?.name,
            def?.snippet,
            def?.description,
            contextForScale(cls.definition?.name, cls.level, grant.levelScale),
          );
        } else {
          const scale = asArray(feature.levelScales)
            .filter((entry) => (entry.level ?? 0) <= cls.level)
            .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
          addClass(
            feature.id,
            feature.name,
            feature.snippet,
            feature.description,
            contextForScale(cls.definition?.name, cls.level, scale),
          );
        }
      }
    }

    // Subclass and optional features not present in the base progression follow.
    for (const grant of grants) {
      if (usedGrants.has(grant)) continue;
      const def = grant.definition;
      addClass(
        def?.id,
        def?.name,
        def?.snippet,
        def?.description,
        contextForScale(cls.definition?.name, cls.level, grant.levelScale),
      );
    }
  }

  const racialTraits: FeatureItem[] = [];
  const seenTrait = new Set<string>();
  for (const trait of asArray(raw.race?.racialTraits)) {
    const def = trait.definition;
    if (!def?.name || def.hideInSheet === true) continue;
    if (/^(?:Speed|Darkvision|Size|Creature Type)$/.test(def.name)) continue;
    const { name, content } = resolve(def.id, def.name, def.snippet, def.description);
    if (!name || seenTrait.has(name)) continue;
    seenTrait.add(name);
    racialTraits.push(toItem(name, def.id, content));
  }

  const feats = asArray(raw.feats)
    .filter(
      (feat) =>
        feat.definition?.name &&
        feat.definition.hideInSheet !== true &&
        !isDisguiseFeat(feat),
    )
    .flatMap((feat) => {
      const def = feat.definition!;
      const { name, content } = resolve(def.id, def.name, def.snippet, def.description);
      return name ? [toItem(name, def.id, content)] : [];
    });

  const groups: FeatureGroup[] = [];
  if (classItems.length) groups.push({ label: 'Class Features', items: classItems });
  if (racialTraits.length) groups.push({ label: 'Racial Traits', items: racialTraits });
  if (feats.length) groups.push({ label: 'Feats', items: feats });
  return groups;
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

/** Damage/condition defence modifier types worth surfacing on the sheet. */
const DEFENCE_TYPES = new Set(['resistance', 'immunity', 'vulnerability']);

type CustomDefenceKind = 'Resistance' | 'Immunity' | 'Vulnerability';

const CUSTOM_DAMAGE_DEFENCES: ReadonlyMap<number, { name: string; kind: CustomDefenceKind }> = (() => {
  const entries = new Map<number, { name: string; kind: CustomDefenceKind }>();
  const baseNames = [
    'Bludgeoning',
    'Piercing',
    'Slashing',
    'Lightning',
    'Thunder',
    'Poison',
    'Cold',
    'Radiant',
    'Fire',
    'Necrotic',
    'Acid',
    'Psychic',
  ];
  baseNames.forEach((name, index) => {
    entries.set(index + 1, { name, kind: 'Resistance' });
    entries.set(index + 17, { name, kind: 'Immunity' });
    entries.set(index + 33, { name, kind: 'Vulnerability' });
  });
  entries.set(47, { name: 'Force', kind: 'Resistance' });
  entries.set(48, { name: 'Force', kind: 'Immunity' });
  entries.set(49, { name: 'Force', kind: 'Vulnerability' });
  const special: [number, string, CustomDefenceKind][] = [
    [13, 'Physical (Magical)', 'Resistance'],
    [14, 'Physical (Silvered)', 'Resistance'],
    [15, 'Physical (Adamantine)', 'Resistance'],
    [16, "Piercing and Slashing from Nonmagical Attacks that aren't Adamantine", 'Resistance'],
    [29, 'Bludgeoning, Piercing, and Slashing from Nonmagical Attacks', 'Immunity'],
    [30, "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks that aren't Silvered", 'Immunity'],
    [31, "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks that aren't Adamantine", 'Immunity'],
    [32, "Piercing and Slashing from Nonmagical Attacks that aren't Adamantine", 'Immunity'],
    [45, 'Piercing from Magic Weapons Wielded by Good Creatures', 'Vulnerability'],
    [46, 'Bludgeoning, Piercing, and Slashing from Magic Weapons', 'Vulnerability'],
    [51, 'Ranged attacks', 'Resistance'],
    [52, 'Damage dealt by traps', 'Resistance'],
    [54, 'Bludgeoning from nonmagical attacks', 'Resistance'],
    [55, 'Bludgeoning, Piercing, and Slashing from Metal Weapons', 'Immunity'],
    [56, 'Bludgeoning, Piercing, and Slashing while in Dim Light or Darkness', 'Resistance'],
    [57, 'Damage from Spells', 'Resistance'],
    [60, "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks that aren't Adamantine or Silvered", 'Immunity'],
    [61, 'Nonmagical Bludgeoning, Piercing, and Slashing (from Stoneskin)', 'Resistance'],
    [62, 'All damage but Force, Radiant, and Psychic', 'Resistance'],
    [63, 'Petrified (Aberrant Armor Only)', 'Immunity'],
    [64, 'Slashing from a Vorpal Sword', 'Vulnerability'],
    [65, "Damage of the type matching the animated breath's form (acid, cold, fire, lightning, or poison)", 'Resistance'],
    [66, 'Psychic (granted by Ruidium Armor)', 'Resistance'],
    [67, 'Bludgeoning, Piercing, and Slashing that is Nonmagical', 'Immunity'],
    [68, 'One of the following: acid, cold, fire, lightning, or poison', 'Resistance'],
    [69, 'Lightning (granted by darksteel greataxe)', 'Resistance'],
    [70, 'Slashing and Piercing from Nonmagical Attacks', 'Resistance'],
  ];
  for (const [id, name, kind] of special) entries.set(id, { name, kind });
  return entries;
})();

/** A short, readable label (plus optional qualifier) for a defensive modifier. */
function defenceEntry(mod: RawModifier): DefenceEntry {
  const type = mod.friendlyTypeName ?? mod.type ?? '';
  if (mod.type === 'advantage' || mod.type === 'disadvantage') {
    // The restriction is the useful part, so it's the main label; the
    // advantage/disadvantage becomes a "(…)" qualifier before it.
    const qualifier = type.charAt(0).toUpperCase() + type.slice(1);
    if (mod.restriction) return { text: mod.restriction, qualifier };
    const ability = ABILITIES.find(
      (entry) => mod.subType === `${entry.name.toLowerCase()}-saving-throws`,
    );
    return { text: ability ? `${ability.name} saves` : 'saves', qualifier };
  }
  const sub = mod.friendlySubtypeName ?? mod.subType ?? '';
  return { text: `${sub} ${type}`.trim() };
}

/** Resistances, immunities, vulnerabilities, and save advantages/disadvantages. */
function resolveDefences(raw: RawCharacter): DefenceEntry[] {
  const seen = new Set<string>();
  const entries: DefenceEntry[] = [];
  const addEntry = (entry: DefenceEntry) => {
    const key = `${entry.text}|${entry.qualifier ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };
  for (const mods of Object.values(raw.modifiers ?? {})) {
    for (const mod of asArray<RawModifier>(mods)) {
      const isDamageDefence = DEFENCE_TYPES.has(mod.type ?? '');
      const isSaveMod =
        (mod.type === 'advantage' || mod.type === 'disadvantage') &&
        (mod.subType === 'saving-throws' ||
          ABILITIES.some(
            (ability) => mod.subType === `${ability.name.toLowerCase()}-saving-throws`,
          ));
      if (!isDamageDefence && !isSaveMod) continue;
      addEntry(defenceEntry(mod));
    }
  }
  for (const custom of asArray(raw.customDefenseAdjustments)) {
    const id = custom.adjustmentId;
    if (id == null) continue;
    if (custom.type === 1) {
      const name = conditionName(id) ?? (id === 16 ? 'Diseased' : undefined);
      if (name) addEntry({ text: `${name} Immunity` });
    } else if (custom.type === 2) {
      const defence = CUSTOM_DAMAGE_DEFENCES.get(id);
      if (defence) addEntry({ text: `${defence.name} ${defence.kind}` });
    }
  }
  // Longest first, so the wordier restrictions lead and the terse resistances
  // trail (a stable sort keeps first-seen order among equal lengths).
  const lengthOf = (entry: DefenceEntry) =>
    entry.text.length + (entry.qualifier?.length ?? 0);
  entries.sort((a, b) => lengthOf(b) - lengthOf(a));
  return entries;
}

function defenceLayoutUnits(entries: DefenceEntry[]): number {
  return entries.reduce((total, entry) => {
    const length = entry.text.length + (entry.qualifier?.length ?? 0);
    return total + Math.max(1, Math.ceil(length / 45));
  }, 0);
}

/** Passive skills shown on the Senses card, by skill key and label. */
const PASSIVE_SENSES: [string, string][] = [
  ['perception', 'Passive Perception'],
  ['investigation', 'Passive Investigation'],
  ['insight', 'Passive Insight'],
];

/** Special-sense modifier subtypes worth surfacing, in display order. */
const SPECIAL_SENSES = ['darkvision', 'blindsight', 'tremorsense', 'truesight'];

const CUSTOM_SENSE_TYPES: Readonly<Record<number, { subtype: string; label: string }>> = {
  1: { subtype: 'blindsight', label: 'Blindsight' },
  2: { subtype: 'darkvision', label: 'Darkvision' },
  3: { subtype: 'tremorsense', label: 'Tremorsense' },
  4: { subtype: 'truesight', label: 'Truesight' },
};

/** Passive skill scores (10 + modifier) plus special senses like Darkvision. */
function resolveSenses(raw: RawCharacter, skills: Skill[]): SenseEntry[] {
  const senses: SenseEntry[] = [];
  const modifierByKey = new Map(skills.map((skill) => [skill.key, skill.modifier]));
  for (const [key, label] of PASSIVE_SENSES) {
    const modifier = modifierByKey.get(key);
    if (modifier !== undefined) senses.push({ label, value: String(10 + modifier) });
  }

  // Special senses come from `set-base` modifiers; keep the largest range each.
  const bySubtype = new Map<string, { label: string; range: number }>();
  if (raw.modifiers) {
    for (const mods of Object.values(raw.modifiers)) {
      for (const mod of asArray<RawModifier>(mods)) {
        const sub = mod.subType ?? '';
        if (mod.type !== 'set-base' || !SPECIAL_SENSES.includes(sub)) continue;
        const range = mod.value ?? mod.fixedValue ?? 0;
        const current = bySubtype.get(sub);
        if (!current || range > current.range) {
          bySubtype.set(sub, { label: mod.friendlySubtypeName ?? sub, range });
        }
      }
    }
  }
  for (const custom of asArray(raw.customSenses)) {
    const sense = CUSTOM_SENSE_TYPES[custom.senseId ?? 0];
    if (sense && custom.distance != null && custom.distance > 0) {
      bySubtype.set(sense.subtype, { label: sense.label, range: custom.distance });
    }
  }
  for (const sub of SPECIAL_SENSES) {
    const entry = bySubtype.get(sub);
    if (entry) senses.push({ label: entry.label, value: `${entry.range} ft.` });
  }

  return senses;
}

/**
 * Convert a raw D&D Beyond character payload into the internal `Character`
 * model. Section counts reflect presence of content; exact per-entry rendering
 * is handled in a later phase. The core stat sections (basics, attributes,
 * skills, saves) are always shown; the rest auto-hide when empty. The ordered
 * phases, source joins, and payload migration procedure are documented in
 * `docs/NORMALIZATION.md`.
 */
export function normalizeCharacter(raw: RawCharacter): Character {
  const classes = summarizeClasses(raw);
  const level = classes.reduce((total, cls) => total + cls.level, 0);
  const avatarUrl = resolveAvatarUrl(raw);
  const abilities = resolveAbilities(raw);
  const resolvePlaceholders = makePlaceholderResolver(
    abilities,
    level,
    resolveMovementSpeeds(raw).walk,
    (ability, castingClass) => castingSaveDcBonus(raw, ability, castingClass),
  );
  const skills = resolveSkills(raw, abilities, level);
  const senses = resolveSenses(raw, skills);
  const defences = resolveDefences(raw);
  const proficiencies = resolveProficiencies(raw);
  const inventory = resolveInventory(raw);
  const attacks = resolveAttacks(raw, abilities, level);
  const {
    companions,
    companionTitle,
    ruleTables,
    companionFeatureIds,
    tableFeatureIds,
  } = resolveRuleArtifacts(raw, resolvePlaceholders);
  const { actions, resourceComponentIds, actionReferencesByComponent } = resolveActions(
    raw,
    abilities,
    level,
    grantedFeatureIds(raw),
    companionFeatureIds,
    resolvePlaceholders,
  );
  const resources = resolveResourceMap(raw, level);
  const spellNamesByComponent = featureSpellNamesByComponent(raw);
  const spells = resolveSpells(raw, level, resolvePlaceholders);
  // A feature doesn't need its own checkboxes when the same limited-use pool is
  // already shown on a corresponding action in the Actions card.
  for (const id of resourceComponentIds) resources.delete(id);
  const features = resolveFeatures(
    raw,
    resources,
    actionReferencesByComponent,
    companionFeatureIds,
    tableFeatureIds,
    spellNamesByComponent,
    resolvePlaceholders,
  );
  const featureCount = features.reduce((total, group) => total + group.items.length, 0);
  const companionPartCount = companions.reduce(
    (total, companion) => total + 1 + companion.details.length,
    0,
  );

  const sections: CharacterSection[] = [
    toSection('portrait', sectionLabel('portrait'), 0, { alwaysPresent: true }),
    toSection('basics', sectionLabel('basics'), asArray(raw.conditions).length, { alwaysPresent: true }),
    toSection('attributes', sectionLabel('attributes'), asArray(raw.stats).length, { alwaysPresent: true }),
    toSection('skills', sectionLabel('skills'), skills.length, { alwaysPresent: true }),
    toSection(
      'savingThrows',
      sectionLabel('savingThrows'),
      Math.max(SAVE_COUNT, defenceLayoutUnits(defences)),
      { alwaysPresent: true },
    ),
    toSection('senses', sectionLabel('senses'), senses.length, { alwaysPresent: true }),
    toSection(
      'proficiencies',
      sectionLabel('proficiencies'),
      Object.values(proficiencies).reduce((total, entries) => total + entries.length, 0),
    ),
    toSection('attacks', sectionLabel('attacks'), attacks.length),
    toSection('actions', sectionLabel('actions'), actions.length),
    toSection('spells', sectionLabel('spells'), spells.length),
    ...(companions.length
      ? [toSection('companions', companionTitle, companionPartCount)]
      : []),
    ...(ruleTables.length
      ? [
          toSection(
            'tables',
            sectionLabel('tables'),
            ruleTables.reduce((total, table) => total + table.rows.length, 0),
          ),
        ]
      : []),
    toSection('inventory', sectionLabel('inventory'), inventory.length),
    toSection('wealth', sectionLabel('wealth'), 0, { alwaysPresent: hasWealth(raw) }),
    toSection('features', sectionLabel('features'), featureCount),
    toSection('notes', sectionLabel('notes'), 0, { alwaysPresent: true }),
  ];

  const character: Character = {
    id: raw.id,
    name: raw.name,
    classes,
    level,
    abilities,
    basics: resolveBasics(raw, abilities, level),
    savingThrows: resolveSavingThrows(raw, abilities, level),
    defences,
    senses,
    skills,
    proficiencies,
    attacks,
    actions,
    spells,
    companions,
    ruleTables,
    inventory,
    wealth: resolveWealth(raw),
    features,
    sections,
  };

  const size = resolveCreatureSize(raw);
  if (size) character.size = size;
  const creatureType =
    raw.race?.creatureTypeId == null ? undefined : CREATURE_TYPES[raw.race.creatureTypeId];
  if (creatureType) character.creatureType = creatureType;

  const race = raw.race?.fullName ?? raw.race?.baseRaceName;
  if (race) character.race = race;

  const background = raw.background?.definition?.name;
  if (background) character.background = background;

  if (avatarUrl) character.avatarUrl = avatarUrl;

  const spellcasting = resolveSpellcasting(raw, abilities, level);
  if (spellcasting) character.spellcasting = spellcasting;

  return character;
}
