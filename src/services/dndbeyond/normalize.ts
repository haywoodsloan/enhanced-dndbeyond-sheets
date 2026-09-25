import {
  ABILITIES,
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
  RawCharacterClass,
  RawFeat,
  RawInventoryItem,
  RawLevelScale,
  RawLimitedUse,
  RawModifier,
  RawSelectedOption,
  RawSpell,
  RawSpellDefinition,
  RawStat,
} from './api-types';
import type {
  AbilityScore,
  ActionCategory,
  Attack,
  Character,
  CharacterAction,
  CharacterBasics,
  CharacterClassSummary,
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
  SavingThrow,
  SectionKey,
  SenseEntry,
  Skill,
  SpellEntry,
  Spellcasting,
  SpellcastingProfile,
  WeaponProperty,
} from './model';
import { RuleArtifacts, leadingLabel, structuredList } from './rule-artifacts';

/** Fixed counts: 6 saving throws and 18 skills in 5e. */
const SAVE_COUNT = 6;
const SKILL_COUNT = 18;

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
    if (parsed.searchParams.has('fit')) parsed.searchParams.set('fit', 'bounds');
    if (parsed.searchParams.has('width')) parsed.searchParams.set('width', '400');
    if (parsed.searchParams.has('height')) parsed.searchParams.set('height', '400');
    return parsed.toString();
  } catch {
    return url;
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

/** Catalogs can contain future-level grants alongside the character's active ones. */
function numericModifiers(raw: RawCharacter): RawModifier[] {
  const active = grantedFeatureIds(raw);
  const conditions = new Set(resolveConditions(raw).map((name) => name.toLowerCase()));
  const armored = asArray(raw.inventory).some((item) =>
    item.equipped && [1, 2, 3, 4].includes(item.definition?.armorTypeId ?? 0),
  );
  const unavailable = new Set<number>();
  for (const cls of asArray(raw.classes)) {
    const features = [
      ...asArray(cls.definition?.classFeatures),
      ...asArray(cls.classFeatures).flatMap(({ definition }) => definition ? [definition] : []),
    ];
    for (const feature of features) {
      if (feature.id != null && (feature.requiredLevel ?? 0) > cls.level) unavailable.add(feature.id);
    }
  }
  const disabledByState = (mod: RawModifier) => {
    if (!conditions.size && !armored) return false;
    const rules = numericModifierRules(raw, mod);
    const disablingCondition = rules.match(/(?:inactive while|ends early if) you have the ([a-z ]+) condition/i);
    return Boolean(
      (disablingCondition && conditions.has(disablingCondition[1].toLowerCase())) ||
      (armored && /if you don armor or a shield/i.test(rules)),
    );
  };
  return Object.values(raw.modifiers ?? {}).flatMap((mods) => asArray<RawModifier>(mods))
    .filter((mod) =>
      (mod.componentTypeId !== 12168134 || mod.componentId == null || !unavailable.has(mod.componentId)) &&
      (mod.componentTypeId !== 258900837 || mod.componentId == null || active.has(mod.componentId)) &&
      !disabledByState(mod),
    );
}

function numericModifierRules(raw: RawCharacter, mod: RawModifier): string {
  if (mod.componentId == null) return '';
  const definitions = [
    ...asArray(raw.classes).flatMap((cls) => [
      ...asArray(cls.definition?.classFeatures),
      ...asArray(cls.classFeatures).flatMap(({ definition }) => definition ? [definition] : []),
    ]),
    ...asArray(raw.feats).flatMap(({ definition }) => definition ? [definition] : []),
    ...asArray(raw.race?.racialTraits).flatMap(({ definition }) => definition ? [definition] : []),
    ...Object.values(raw.options ?? {}).flatMap((options) =>
      asArray<RawSelectedOption>(options).flatMap(({ definition }) => definition ? [definition] : [])),
  ];
  const definition = definitions.find(({ id }) => id === mod.componentId);
  return plainText(definition?.description || definition?.snippet || '');
}

function numericModifierValue(
  raw: RawCharacter,
  mod: RawModifier,
  abilities: AbilityScore[] = [],
): number {
  const fixed = mod.value ?? mod.fixedValue;
  if (fixed != null) return fixed;
  if (mod.statId != null) {
    const value = abilities.find(({ key }) => key === abilityKeyById(mod.statId))?.modifier ?? 0;
    const minimum = numericModifierRules(raw, mod)
      .match(/\b(?:bonus|add)\b[^.!?;]*modifier\s*\(minimum(?: bonus)?(?: of)? \+?(\d+)\)/i);
    return minimum ? Math.max(value, Number(minimum[1])) : value;
  }
  if (mod.bonusTypes?.includes(1)) {
    return proficiencyBonus(asArray(raw.classes).reduce((sum, cls) => sum + cls.level, 0));
  }
  return 0;
}

/** Unrestricted bonuses from currently applicable sources. */
function sumBonusModifiers(raw: RawCharacter, subType: string, abilities: AbilityScore[] = []): number {
  return numericModifiers(raw)
    .filter((mod) => mod.type === 'bonus' && mod.subType === subType && !mod.restriction?.trim())
    .reduce((sum, mod) => sum + numericModifierValue(raw, mod, abilities), 0);
}

/** Sum ability-score bonus modifiers for one ability (e.g. "strength-score"). */
function abilityScoreBonus(raw: RawCharacter, abilityName: string): number {
  const raceModifiers = new Set(raw.race?.isLegacy === false ? asArray(raw.modifiers?.race) : []);
  return numericModifiers(raw)
    .filter((mod) => mod.type === 'bonus' && mod.subType === `${abilityName.toLowerCase()}-score` &&
      !mod.restriction?.trim() && !raceModifiers.has(mod))
    .reduce((sum, mod) => sum + (mod.value ?? mod.fixedValue ?? 0), 0);
}

/**
 * Resolve the six final ability scores: base stat + manual bonus + granted
 * ability-score bonuses, unless an explicit override is set. The modifier is
 * derived from the resolved score.
 */
function resolveAbilities(raw: RawCharacter): AbilityScore[] {
  return ABILITIES.map((meta) => {
    const override = statValue(raw.overrideStats, meta.id);
    const base =
      override != null
        ? override
        : (statValue(raw.stats, meta.id) ?? 10) +
          (statValue(raw.bonusStats, meta.id) ?? 0) +
          abilityScoreBonus(raw, meta.name);
    const minimums = numericModifiers(raw)
      .filter((mod) => mod.type === 'set' && mod.subType === `${meta.name.toLowerCase()}-score` &&
        !mod.restriction?.trim())
      .map((mod) => mod.value ?? mod.fixedValue ?? 0);
    const score = override != null ? override : Math.max(base, ...minimums);
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
function resolveArmorClass(raw: RawCharacter, abilities: AbilityScore[]): number {
  const override = asArray(raw.characterValues).find(({ typeId, value }) =>
    typeId === 1 && value != null && value !== '' && Number.isFinite(Number(value)),
  );
  if (override) return Number(override.value);
  const dexModifier = abilities.find(({ key }) => key === 'dex')?.modifier ?? 0;
  const worn = asArray(raw.inventory).filter(
    (item) => item.equipped === true && item.definition?.filterType === 'Armor',
  );
  const shield = worn.find((item) => item.definition?.armorTypeId === 4);
  const armor = worn.find((item) => {
    const id = item.definition?.armorTypeId;
    return id === 1 || id === 2 || id === 3;
  });
  const unarmoredBonus = Math.max(0, ...numericModifiers(raw)
    .filter((mod) => mod.type === 'set' && mod.subType === 'unarmored-armor-class' &&
      !mod.restriction?.trim() && (!shield ||
        !/(?:aren['’]t|are not|not) wearing armor or (?:wielding|using) a shield/i.test(numericModifierRules(raw, mod))))
    .map((mod) => numericModifierValue(raw, mod, abilities)));
  return armorClass({
    category: ARMOR_CATEGORY[armor?.definition?.armorTypeId ?? 0] ?? 'none',
    armorBase: armor?.definition?.armorClass ?? 0,
    dexModifier,
    shieldBonus: shield?.definition?.armorClass ?? 0,
    bonus: sumBonusModifiers(raw, 'armor-class', abilities) +
      (!armor && !shield ? sumBonusModifiers(raw, 'unarmored-armor-class', abilities) : 0),
    unarmoredBonus,
  });
}

type MovementSpeed = 'walk' | 'fly' | 'swim' | 'climb' | 'burrow';

function resolveMovementSpeeds(raw: RawCharacter): Record<MovementSpeed, number> {
  const normal = raw.race?.weightSpeeds?.normal;
  const speeds = {
    walk: normal?.walk ?? 30, fly: normal?.fly ?? 0, swim: normal?.swim ?? 0,
    climb: normal?.climb ?? 0, burrow: normal?.burrow ?? 0,
  };
  const worn = asArray(raw.inventory).filter((item) => item.equipped);
  const armored = worn.some((item) => [1, 2, 3, 4].includes(item.definition?.armorTypeId ?? 0));
  const heavyArmor = worn.some((item) => item.definition?.armorTypeId === 3);
  const mediumArmor = worn.some((item) => item.definition?.armorTypeId === 2);
  const eligible = (mod: RawModifier) => {
    const restriction = mod.restriction?.trim() ?? '';
    if (!restriction) {
      return !(heavyArmor && mod.type === 'bonus' &&
        /^speed(?:-walking)?$/.test(mod.subType ?? '') &&
        /(?:aren['’]t|are not|not) wearing heavy armor/i.test(numericModifierRules(raw, mod)));
    }
    if (/^(?:while you (?:aren['’]t|are not) wearing|while not wearing) heavy armor\.?$/i.test(restriction)) {
      return !heavyArmor;
    }
    if (/^cannot be used if wearing medium or heavy armor\.?$/i.test(restriction)) {
      return !mediumArmor && !heavyArmor;
    }
    if (/^(?:and )?(?:you )?can (?:also )?hover\.?$/i.test(restriction)) return true;
    return false;
  };
  const mods = numericModifiers(raw).filter(eligible);
  const speedBonus = mods
    .filter((mod) => mod.type === 'bonus' && ['speed', 'speed-walking'].includes(mod.subType ?? ''))
    .reduce((sum, mod) => sum + numericModifierValue(raw, mod), 0);
  speeds.walk += speedBonus;
  if (!armored) {
    const movement = mods.filter((mod) => mod.type === 'bonus' && mod.subType === 'unarmored-movement');
    if (movement.length) {
      speeds.walk += movement.reduce((sum, mod) => sum + numericModifierValue(raw, mod), 0);
    } else {
      for (const cls of asArray(raw.classes)) {
        for (const feature of asArray(cls.classFeatures)) {
          if (feature.definition?.name === 'Unarmored Movement' &&
            (feature.definition.requiredLevel ?? 0) <= cls.level) {
            speeds.walk += feature.levelScale?.fixedValue ?? 0;
          }
        }
      }
    }
  }
  const movements: [MovementSpeed, string, number][] = [
    ['walk', 'walking', 1], ['fly', 'flying', 4], ['swim', 'swimming', 5],
    ['climb', 'climbing', 3], ['burrow', 'burrowing', 2],
  ];
  for (const [key, subtype] of movements) {
    for (const mod of mods) {
      if (mod.type === 'set' && [`speed-${subtype}`, `innate-speed-${subtype}`].includes(mod.subType ?? '')) {
        speeds[key] = Math.max(speeds[key], mod.value ?? mod.fixedValue ?? speeds.walk);
      }
    }
  }
  for (const [key, , id] of movements) {
    const custom = asArray(raw.customSpeeds).find(({ movementId }) => movementId === id);
    if (custom?.distance != null) speeds[key] = custom.distance;
  }
  return speeds;
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
  const max = maxHitPoints({
    base: raw.baseHitPoints ?? 0,
    conModifier: modifierOf('con'),
    level,
    bonus: (raw.bonusHitPoints ?? 0) + Object.values(raw.modifiers ?? {}).reduce(
      (total, mods) => total + asArray<RawModifier>(mods)
        .filter((mod) => mod.type === 'bonus' && mod.subType === 'hit-points-per-level')
        .reduce((sum, mod) => {
          const cls = asArray(raw.classes).find((cls) =>
            mod.componentId != null && (
              asArray(cls.classFeatures).some(({ definition }) => definition?.id === mod.componentId) ||
              asArray(cls.definition.classFeatures).some(({ id }) => id === mod.componentId)
            ),
          );
          return sum + (mod.value ?? mod.fixedValue ?? 0) * (cls?.level ?? level);
        }, 0), 0,
    ),
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
  const specialSpeeds = [
    { label: 'Fly', value: speeds?.fly ?? 0 },
    { label: 'Swim', value: speeds?.swim ?? 0 },
    { label: 'Climb', value: speeds?.climb ?? 0 },
    { label: 'Burrow', value: speeds?.burrow ?? 0 },
  ].filter(({ value }) => value > 0);
  const conditionLevels: Record<string, number> = {};
  for (const condition of asArray(raw.conditions)) {
    const name = conditionName(condition.id);
    if (name && condition.level != null && condition.level > 0) {
      conditionLevels[name] = condition.level;
    }
  }
  return {
    armorClass: resolveArmorClass(raw, abilities),
    initiative: modifierOf('dex') + sumBonusModifiers(raw, 'initiative', abilities),
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
    ...(Object.keys(conditionLevels).length ? { conditionLevels } : {}),
  };
}

/** True when any top-level modifier matches the given type and subtype. */
function hasModifier(raw: RawCharacter, type: string, subType: string): boolean {
  return numericModifiers(raw).some(
    (mod) => mod.type === type && mod.subType === subType && !mod.restriction?.trim(),
  );
}

/** True when the character is proficient in a given ability's saving throw. */
function hasSaveProficiency(raw: RawCharacter, abilityName: string): boolean {
  return hasModifier(raw, 'proficiency', 'saving-throws') ||
    hasModifier(raw, 'proficiency', `${abilityName.toLowerCase()}-saving-throws`);
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
    const proficient = hasSaveProficiency(raw, meta.name);
    const bonus =
      sumBonusModifiers(raw, 'saving-throws', abilities) +
      sumBonusModifiers(raw, `${meta.name.toLowerCase()}-saving-throws`, abilities);
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

/** Highest proficiency level the character has in a skill. */
function skillProficiency(raw: RawCharacter, skillKey: string): ProficiencyLevel {
  if (hasModifier(raw, 'expertise', skillKey)) return 'expertise';
  if (hasModifier(raw, 'proficiency', skillKey)) return 'proficient';
  if (hasModifier(raw, 'half-proficiency', skillKey) ||
    hasModifier(raw, 'half-proficiency', 'ability-checks')) return 'half';
  return 'none';
}

/** The 18 skills: ability modifier + proficiency contribution. */
function resolveSkills(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): Skill[] {
  const prof = proficiencyBonus(level);
  const modifierByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  return SKILLS.map((meta) => {
    const proficiency = skillProficiency(raw, meta.key);
    const abilityMod = modifierByKey.get(meta.ability) ?? 0;
    return {
      key: meta.key,
      name: meta.name,
      ability: meta.ability,
      proficiency,
      modifier: abilityMod + proficiencyContribution(proficiency, prof) +
        sumBonusModifiers(raw, meta.key, abilities) +
        sumBonusModifiers(raw, 'ability-checks', abilities) +
        sumBonusModifiers(raw, `${ABILITIES.find(({ key }) => key === meta.ability)?.name.toLowerCase()}-ability-checks`, abilities),
    };
  });
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
        const label = mod.friendlySubtypeName;
        if (!label) continue;
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

  for (const proficiency of asArray(raw.customProficiencies)) {
    const name = proficiency.name?.trim();
    if (!name) continue;
    if (proficiency.type === 2) pushUnique(tools, name);
    else if (proficiency.type === 3) pushUnique(languages, name);
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
    .replace(/<li\b[^>]*>/gi, ' • ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[(items?|spells?|conditions?|monsters?|magicitems?|rules?|skills?|wprops?)\]([^[]*?)\[\/\1\]/gi,
      (_match, _tag: string, body: string) => body.includes(';') ? body.slice(body.indexOf(';') + 1) : body)
    .replace(/\[(\d*d\d+s?)\]/gi, '$1')
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

/** Retain table contents inline when there is no separate rules-table section. */
function completeRules(html: string): string {
  return richText(html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_table, contents: string) =>
    contents
      .replace(/<tr\b[^>]*>/gi, '<li>')
      .replace(/<\/tr>/gi, '</li>')
      .replace(/<\/t[dh]>\s*<t[dh]\b[^>]*>/gi, ' | '),
  ));
}

/**
 * A resolver for D&D Beyond's `{{…}}` dynamic-value placeholders, bound to this
 * character's level and ability modifiers. Handles the common forms —
 * `{{classlevel}}`, `{{proficiency}}`, `{{modifier:cha}}` (with optional
 * `@min:N` / `#unsigned` flags), `{{savedc:wis}}` (a spell/feature save DC), and
 * simple `{{(classlevel/2)@rounddown}}` / `{{13+proficiency}}` arithmetic — and
 * drops any placeholder it can't resolve (e.g. `{{scalevalue}}`). Modifiers
 * render signed unless `#unsigned`; other numbers honor an explicit `#signed`.
 */
function makePlaceholderResolver(
  abilities: AbilityScore[],
  level: number,
  classLevel = level,
  scale?: RawLevelScale,
): (text: string) => string {
  const modByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  return (text) =>
    text.replace(/\bDC (\d+) plus your Proficiency Bonus\b/gi, (_whole, base: string) =>
      `DC ${Number(base) + proficiencyBonus(level)}`,
    ).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_whole, expr: string) => {
      const [beforeHash, format = ''] = expr.split('#');
      const [core, ...flags] = beforeHash.split('@').map((part) => part.trim());
      const modMatch = /^modifier:([a-z]+)/i.exec(core);
      const saveDcMatch = /^savedc:([a-z]+)/i.exec(core);
      let value: number | undefined;
      if (/^classlevel$/i.test(core)) {
        value = classLevel;
      } else if (/^characterlevel$/i.test(core)) {
        value = level;
      } else if (/^scalevalue$/i.test(core)) {
        if (scale?.dice?.diceString) return scale.dice.diceString;
        value = scale?.fixedValue ?? undefined;
      } else if (/^proficiency(?:bonus)?$/i.test(core)) {
        value = proficiencyBonus(level);
      } else if (saveDcMatch) {
        // Save DC = 8 + proficiency + the relevant ability's modifier.
        const mod = modByKey.get(saveDcMatch[1].slice(0, 3).toLowerCase() as AbilityKey);
        if (mod != null) value = 8 + proficiencyBonus(level) + mod;
      } else if (modMatch) {
        value = modByKey.get(modMatch[1].slice(0, 3).toLowerCase() as AbilityKey);
      } else {
        // Simple binary arithmetic on the class level or proficiency bonus, e.g.
        // (classlevel/2) or 13+proficiency.
        const arith = core
          .replace(/classlevel/gi, String(classLevel))
          .replace(/characterlevel/gi, String(level))
          .replace(/proficiency(?:bonus)?/gi, String(proficiencyBonus(level)));
        const parts = /^\(?\s*(-?\d+)\s*([+\-*/])\s*(-?\d+)\s*\)?$/.exec(arith);
        if (parts) {
          const a = Number(parts[1]);
          const b = Number(parts[3]);
          const op = parts[2];
          value = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
        }
      }
      if (value == null || !Number.isFinite(value)) return ''; // unresolved -> drop
      for (const flag of flags) {
        const min = /^min:(-?\d+)/.exec(flag);
        const max = /^max:(-?\d+)/.exec(flag);
        if (min) value = Math.max(value, Number(min[1]));
        else if (max) value = Math.min(value, Number(max[1]));
        else if (/rounddown/i.test(flag)) value = Math.floor(value);
        else if (/roundup/i.test(flag)) value = Math.ceil(value);
      }
      value = Math.round(value);
      if (/^signed$/i.test(format.trim()) || (modMatch && !/unsigned/i.test(format))) {
        return value >= 0 ? `+${value}` : String(value);
      }
      return String(value);
    });
}

type PlaceholderResolver = (text: string) => string;
type ComponentResolver = (componentId?: number | null) => PlaceholderResolver;

function componentResolvers(raw: RawCharacter, abilities: AbilityScore[], level: number): ComponentResolver {
  const resolvers = new Map<number, PlaceholderResolver>();
  for (const cls of asArray(raw.classes)) {
    const add = (id: number | undefined, scales: RawLevelScale[] | null | undefined, active?: RawLevelScale | null) => {
      if (id == null) return;
      const scale = active ?? asArray(scales)
        .filter((entry) => (entry.level ?? 0) <= cls.level)
        .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
      resolvers.set(id, makePlaceholderResolver(abilities, level, cls.level, scale));
    };
    for (const feature of asArray(cls.definition.classFeatures)) add(feature.id, feature.levelScales);
    for (const feature of asArray(cls.classFeatures)) add(feature.definition?.id, feature.definition?.levelScales, feature.levelScale);
  }
  const options = Object.values(raw.options ?? {}).flatMap((group) => asArray<RawSelectedOption>(group));
  for (let pass = 0; pass < options.length; pass++) {
    let changed = false;
    for (const option of options) {
      const id = option.definition?.id;
      const parent = option.componentId != null ? resolvers.get(option.componentId) : undefined;
      if (id != null && parent && !resolvers.has(id)) {
        resolvers.set(id, parent);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const fallback = makePlaceholderResolver(abilities, level);
  return (id) => id != null ? resolvers.get(id) ?? fallback : fallback;
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
  const attack: Attack = {
    name: def.name!,
    toHit: abilityMod + (isWeaponProficient(raw, def) ? prof : 0) + magic,
  };
  if (def.fixedDamage != null) {
    attack.damage = {
      dice: '',
      bonus: def.fixedDamage + magic,
      ...(def.damageType ? { type: def.damageType } : {}),
    };
  } else if (def.damage?.diceString) {
    attack.damage = {
      dice: def.damage.diceString,
      bonus: abilityMod + magic,
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
  let unarmedDice = '';
  let unarmedModifier = modOf('str');
  const equipped = asArray(raw.inventory).filter((item) => item.equipped === true);
  const armored = equipped.some(({ definition }) =>
    definition?.filterType === 'Armor' || [1, 2, 3, 4].includes(definition?.armorTypeId ?? 0),
  );
  if (!armored) {
    for (const cls of asArray(raw.classes)) {
      const granted = asArray(cls.classFeatures);
      const features = [
        ...granted,
        ...asArray(cls.definition.classFeatures)
          .filter((definition) => !granted.some((feature) =>
            feature.definition?.id != null
              ? feature.definition.id === definition.id
              : feature.definition?.name === definition.name))
          .map((definition) => ({ definition, levelScale: undefined })),
      ];
      for (const feature of features) {
        const definition = feature.definition;
        if (definition?.name?.toLowerCase() !== 'martial arts' ||
          (definition.requiredLevel ?? 1) > cls.level) continue;
        const rules = plainText(definition.description || definition.snippet || '');
        const lightMartialWeapons = /martial melee weapons[^.!?]*light/i.test(rules);
        const nonMonkWeapon = equipped.some(({ definition: weapon }) => {
          if (weapon?.filterType !== 'Weapon') return false;
          const properties = asArray(weapon.properties).map(({ name }) => name?.toLowerCase());
          if (weapon.attackType !== 1) return true;
          if (weapon.categoryId === 1) {
            return !lightMartialWeapons && (properties.includes('heavy') || properties.includes('two-handed'));
          }
          return lightMartialWeapons
            ? !properties.includes('light')
            : !/^shortsword(?:\b|$)/i.test(weapon.name ?? '');
        });
        if (nonMonkWeapon) continue;
        const scale = feature.levelScale && (feature.levelScale.level ?? 0) <= cls.level
          ? feature.levelScale
          : asArray(definition.levelScales)
            .filter(({ level: requiredLevel }) => (requiredLevel ?? 0) <= cls.level)
            .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
        const dice = scale?.dice;
        const expression = dice?.diceString ||
          (dice?.diceCount && dice.diceValue ? `${dice.diceCount}d${dice.diceValue}` : '');
        if (!expression) continue;
        unarmedDice = expression;
        unarmedModifier = Math.max(modOf('str'), modOf('dex'));
      }
    }
  }
  // The source's Martial Arts scale replaces normal damage, not an extra die
  // added to the universal 1 + Strength fallback.
  attacks.push({
    name: 'Unarmed Strike',
    toHit: unarmedModifier + prof,
    damage: {
      dice: unarmedDice,
      bonus: unarmedDice ? unarmedModifier : Math.max(0, 1 + unarmedModifier),
      type: 'Bludgeoning',
    },
    range: '5 ft.',
  });
  return attacks;
}

/** The character's primary spellcasting ability id, if any class casts. */
function spellcastingAbilityId(raw: RawCharacter): number | undefined {
  for (const cls of asArray(raw.classes)) {
    const id = cls.subclassDefinition?.spellCastingAbilityId ?? cls.definition?.spellCastingAbilityId;
    if (id != null) return id;
  }
  return undefined;
}

/** Spell save DC: 8 + proficiency bonus + spellcasting ability modifier. */
function spellSaveDc(raw: RawCharacter, abilities: AbilityScore[], level: number): number {
  const key = abilityKeyById(spellcastingAbilityId(raw));
  const mod = abilities.find((ability) => ability.key === key)?.modifier ?? 0;
  return 8 + proficiencyBonus(level) + mod;
}

/** Full-caster and half-caster classes, for the effective caster-level sum. */
const FULL_CASTERS = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard']);
const HALF_CASTERS = new Set(['paladin', 'ranger']);

/**
 * Effective caster level for the multiclass spell-slot table: full casters add
 * their level, half casters half (round down), an artificer half (round up).
 * Warlock (pact magic) is intentionally excluded — its slots aren't on this
 * table.
 */
function casterLevel(raw: RawCharacter): number {
  let total = 0;
  for (const cls of asArray(raw.classes)) {
    const name = cls.definition?.name?.toLowerCase() ?? '';
    const rules = cls.definition?.spellRules;
    if (name === 'warlock') continue;
    if (rules?.multiClassSpellSlotDivisor && rules.multiClassSpellSlotDivisor > 0) {
      const value = cls.level / rules.multiClassSpellSlotDivisor;
      total += rules.multiClassSpellSlotRounding === 2 ? Math.ceil(value) : Math.floor(value);
    } else if (FULL_CASTERS.has(name)) total += cls.level;
    else if (HALF_CASTERS.has(name)) total += Math.floor(cls.level / 2);
    else if (name === 'artificer') total += Math.ceil(cls.level / 2);
  }
  return total;
}

function castingFocus(
  cls: RawCharacter['classes'][number],
  resolveForComponent: ComponentResolver,
): string | undefined {
  const features = [
    ...asArray(cls.classFeatures).map((entry) => entry.definition),
    ...asArray(cls.definition?.classFeatures),
  ];
  for (const feature of features) {
    if (!feature || !/^(Spellcasting|Pact Magic)$/.test(feature.name ?? '')) continue;
    const { parts } = parseFeatureParts(feature.description || feature.snippet, resolveForComponent(feature.id));
    const focus = parts.filter((part) => /^(Tools Required|Spellcasting Focus)$/i.test(part.label))
      .map((part) => part.text).filter(Boolean).join(' ');
    if (focus) return focus;
  }
  return undefined;
}

/** Spellcasting summary (ability, modifier, attack, save DC, slots), or nothing
 * for a character with no spellcasting ability or slots. */
function resolveSpellcasting(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): Spellcasting | undefined {
  const key = abilityKeyById(spellcastingAbilityId(raw));
  if (!key) return undefined;
  const modifier = abilities.find((ability) => ability.key === key)?.modifier ?? 0;
  const prof = proficiencyBonus(level);
  // Trim trailing zero levels so the slots array ends at the highest usable level.
  const casters = asArray(raw.classes).filter((cls) =>
    abilityKeyById(cls.subclassDefinition?.spellCastingAbilityId ?? cls.definition?.spellCastingAbilityId));
  const isPact = (cls: typeof casters[number]): boolean => {
    const rows = asArray(cls.definition?.spellRules?.levelSpellSlots);
    return cls.definition?.name?.toLowerCase() === 'warlock' ||
      (rows.length > 0 && rows.every((row) => row.filter((count) => count > 0).length <= 1) &&
        rows.some((row) => row[0] === 0 && row.slice(1).some((count) => count > 0)));
  };
  const standard = casters.filter((cls) => !isPact(cls));
  const direct = standard.length === 1 ? standard[0].definition?.spellRules?.levelSpellSlots?.[standard[0].level] : undefined;
  const slots = direct?.length ? [...direct] : spellSlotsForCasterLevel(casterLevel({ ...raw, classes: standard }));
  while (slots.length && slots[slots.length - 1] === 0) slots.pop();
  const profiles = casters.map((cls) => {
    const ability = abilityKeyById(cls.subclassDefinition?.spellCastingAbilityId ?? cls.definition?.spellCastingAbilityId)!;
    const mod = abilities.find((entry) => entry.key === ability)?.modifier ?? 0;
    const source = cls.definition?.name ?? cls.subclassDefinition?.name ?? 'Spellcasting';
    const classKey = source.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const attack = mod + prof + sumBonusModifiers(raw, 'spell-attacks', abilities) +
      sumBonusModifiers(raw, `${classKey}-spell-attacks`, abilities);
    const saveDc = 8 + prof + mod + sumBonusModifiers(raw, 'spell-save-dc', abilities) +
      sumBonusModifiers(raw, `${classKey}-spell-save-dc`, abilities);
    const focus = castingFocus(cls, componentResolvers(raw, abilities, level));
    return { source, ability: ability.toUpperCase(), modifier: mod, attack, saveDc, ...(focus ? { focus } : {}) };
  });
  const pactSlots = casters.filter(isPact).flatMap((cls) => {
    const row = cls.definition?.spellRules?.levelSpellSlots?.[cls.level] ?? [];
    return row.flatMap((max, index) => max > 0
      ? [{ source: cls.definition?.name ?? 'Pact Magic', level: index + 1, max }] : []);
  });
  return {
    ability: key.toUpperCase(),
    modifier,
    attack: profiles[0]?.attack ?? modifier + prof + sumBonusModifiers(raw, 'spell-attacks', abilities),
    saveDc: profiles[0]?.saveDc ?? 8 + prof + modifier,
    slots,
    profiles,
    ...(pactSlots.length ? { pactSlots } : {}),
  };
}

/** Damage line for an action from its dice, ability modifier, and type. */
function actionDamage(
  action: RawAction,
  modByStatId: (id: number | null | undefined) => number,
): DamageInfo | undefined {
  const dice = action.dice?.diceString ?? '';
  if (!dice && action.value == null && action.dice?.fixedValue == null) return undefined;
  const writtenFixed = /([+-]\s*\d+)\s*$/.exec(dice)?.[1];
  // DDB repeats an embedded dice constant in fixedValue; it is not another bonus.
  const fixedIncluded = writtenFixed != null && action.dice?.fixedValue != null &&
    Number(writtenFixed.replace(/\s+/g, '')) === action.dice.fixedValue;
  const bonus = modByStatId(action.abilityModifierStatId) +
    (fixedIncluded ? 0 : action.dice?.fixedValue ?? action.value ?? 0) + (action.damageBonus ?? 0);
  const type = damageTypeName(action.damageTypeId);
  const damage: DamageInfo = { dice };
  if (bonus) damage.bonus = bonus;
  if (type) damage.type = type;
  return damage;
}

/**
 * D&D Beyond `componentTypeId`s that identify a feature grantor: a class
 * feature, a feat, or a racial trait. An action tagged with one of these but
 * whose `componentId` isn't a feature the character actually has is an orphan
 * (a leftover from an unselected option) and is dropped.
 */
const FEATURE_COMPONENT_TYPES = new Set([
  12168134, 1088085227, 1960452172, 258900837, 306912077,
]);

/** Ids of every feature/feat/trait the character actually has, for grantor checks. */
function grantedFeatureIds(raw: RawCharacter): Set<number> {
  const ids = new Set<number>();
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (feature.id != null && (feature.requiredLevel ?? 0) <= cls.level) ids.add(feature.id);
    }
    for (const feature of asArray(cls.classFeatures)) {
      if (feature.definition?.id != null && (feature.definition.requiredLevel ?? 0) <= cls.level) {
        ids.add(feature.definition.id);
      }
    }
  }
  for (const trait of asArray(raw.race?.racialTraits)) {
    if (trait.definition?.id != null) ids.add(trait.definition.id);
  }
  for (const feat of asArray(raw.feats)) {
    if (feat.definition?.id != null) ids.add(feat.definition.id);
  }
  const options = Object.values(raw.options ?? {}).flatMap((group) => asArray<RawSelectedOption>(group));
  for (let pass = 0; pass < options.length; pass++) {
    let changed = false;
    for (const option of options) {
      const id = option.definition?.id;
      if (id != null && !ids.has(id) && (option.componentId == null || ids.has(option.componentId))) {
        ids.add(id);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return ids;
}

/** Action rules are authoritative: snippets can omit limitations and effects. */
function actionDetail(
  snippet: string | null | undefined,
  description: string | null | undefined,
  resolvePlaceholders: (text: string) => string,
): string {
  return completeRules(resolvePlaceholders(description || snippet || ''));
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
 * `actionNamesByComponent` maps each grantor id to its action names, so a
 * feature can show a brief note (instead of the full text) for a sub-part that
 * is detailed as an action.
 */
function resolveActions(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
  grantedIds: Set<number>,
  resolveForComponent: ComponentResolver,
  artifacts: RuleArtifacts,
): {
  actions: CharacterAction[];
  resourceComponentIds: Set<number>;
  actionNamesByComponent: Map<number, string[]>;
  detailedActionNames: Set<string>;
} {
  const modByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  const modByStatId = (id: number | null | undefined) =>
    modByKey.get(abilityKeyById(id) ?? ('' as AbilityKey)) ?? 0;
  const saveDc = spellSaveDc(raw, abilities, level);

  const actions: CharacterAction[] = [];
  const resourceComponentIds = new Set<number>();
  const actionNamesByComponent = new Map<number, string[]>();
  const detailedActionNames = new Set<string>();
  const seen = new Set<string>();
  if (raw.actions) {
    for (const group of Object.values(raw.actions)) {
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
        const resource = limitedUseToPool(action.limitedUse, level, abilities, action.description, action.snippet);
        if (resource) {
          // A pool that resets on a long rest but also regains one use on a
          // short rest (Channel Divinity): the reset type only records the long
          // rest, so read the short-rest recovery from the blurb and show both.
          if (
            resource.recharge === 'LR' &&
            regainsOneOnShortRest(action.snippet, action.description)
          ) {
            resource.recharge = 'SR1_LR';
          }
          entry.resource = resource;
          if (action.componentId != null) resourceComponentIds.add(action.componentId);
        }
        const damage = actionDamage(action, modByStatId);
        if (damage) entry.damage = damage;
        const saveKey = abilityKeyById(action.saveStatId);
        if (saveKey) {
          entry.save = `DC ${action.fixedSaveDc ?? saveDc} ${saveKey.toUpperCase()}`;
        }
        const range = action.range?.range;
        if (range) entry.range = `${range} ft.`;
        const content = artifacts.extract(
          resolveForComponent(action.componentId)(action.description || action.snippet || ''),
          action.componentId == null ? action.name : spellGrantSource(raw, action.componentId) ?? action.name,
          action.componentId ?? undefined,
        );
        let summary = actionDetail(undefined, content.html, (text) => text);
        if (content.related) entry.related = content.related;
        const hasRules = Boolean(summary);
        if (entry.save && !/\bDC\s*\d+/i.test(summary)) {
          summary = `${summary}${summary ? ' ' : ''}(${entry.save})`;
        }
        if (summary) entry.summary = summary;
        // Note real activations (Action / Bonus Action / Reaction) by name, so a
        // whole feature that IS one (Innate Sorcery, or Channel Divinity — whose
        // Divine Spark / Turn Undead effects are themselves actions) can point to
        // the Actions card instead of repeating its text.
        if (category !== 'other' && hasRules) {
          detailedActionNames.add(action.name);
        }
        if (action.componentId != null && hasRules) {
          const names = actionNamesByComponent.get(action.componentId);
          if (names) names.push(action.name);
          else actionNamesByComponent.set(action.componentId, [action.name]);
        }
        actions.push(entry);
      }
    }
  }
  return { actions, resourceComponentIds, actionNamesByComponent, detailedActionNames };
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

/** Duration shorthand, prefixed with "Conc," when the spell needs concentration. */
function spellDuration(
  duration: RawSpellDefinition['duration'],
  concentration: boolean | undefined,
): string {
  if (!duration) return '';
  if (duration.durationType === 'Instantaneous') return 'Instant';
  const base =
    duration.durationInterval && duration.durationUnit
      ? `${duration.durationInterval} ${duration.durationUnit.toLowerCase()}`
      : (duration.durationType ?? '');
  if (!base) return '';
  return concentration ? `Conc, ${base}` : base;
}

/** Base damage dice + type + upcast scaling from a spell's modifiers. */
function spellDamage(def: RawSpellDefinition, characterLevel: number): DamageInfo | undefined {
  const mod = asArray(def.modifiers).find(
    (entry) => entry.type === 'damage' && entry.die?.diceString,
  );
  if (!mod?.die?.diceString) return undefined;
  const damage: DamageInfo = { dice: mod.die.diceString };
  if (mod.friendlySubtypeName) damage.type = mod.friendlySubtypeName;

  // A cantrip scales with CHARACTER level: show its dice at the current level
  // (no "increases with level" note — just the value it's at now).
  if ((def.level ?? 0) === 0 && def.scaleType === 'characterlevel') {
    const multiplier = cantripDiceMultiplier(characterLevel);
    if (multiplier > 1 && mod.die.diceValue) {
      damage.dice = `${(mod.die.diceCount ?? 1) * multiplier}d${mod.die.diceValue}`;
    }
    return damage;
  }

  // A leveled spell notes the extra dice per slot level above its own.
  const higher = asArray(def.atHigherLevels?.higherLevelDefinitions).find(
    (entry) => entry.dice?.diceString,
  );
  if (higher?.dice?.diceString) damage.scaling = `+${higher.dice.diceString}/slot`;
  return damage;
}

/** Known/prepared spells from class spells and other sources, deduped and sorted. */
function resolveSpells(
  raw: RawCharacter,
  level: number,
  abilities: AbilityScore[],
  grantedIds: Set<number>,
  resolveForComponent: ComponentResolver,
  artifacts: RuleArtifacts,
  spellcasting: Spellcasting | undefined,
): SpellEntry[] {
  const byName = new Map<string, SpellEntry>();
  const useSources = new Map<string, Set<string>>();
  const castingProfile = (spell: RawSpell, cls?: RawCharacterClass): SpellcastingProfile | undefined => {
    const key = abilityKeyById(spell.spellCastingAbilityId ??
      cls?.subclassDefinition?.spellCastingAbilityId ?? cls?.definition?.spellCastingAbilityId);
    if (!key) return undefined;
    const source = cls?.definition?.name ?? (spell.componentId == null
      ? spellcasting?.profiles?.find((profile) => profile.ability === key.toUpperCase())?.source
      : spellGrantSource(raw, spell.componentId)) ?? 'Spell grant';
    const profile = cls && spellcasting?.profiles?.find((entry) =>
      entry.source === source && entry.ability === key.toUpperCase());
    if (profile) return { ...profile };
    const modifier = abilities.find((ability) => ability.key === key)?.modifier ?? 0;
    const proficiency = proficiencyBonus(level);
    return {
      source, ability: key.toUpperCase(), modifier,
      attack: modifier + proficiency + sumBonusModifiers(raw, 'spell-attacks', abilities),
      saveDc: 8 + proficiency + modifier + sumBonusModifiers(raw, 'spell-save-dc', abilities),
    };
  };
  const add = (spell: RawSpell, cls?: RawCharacterClass) => {
    const def = spell.definition;
    if (def?.name == null) return;
    if (spell.componentTypeId != null && FEATURE_COMPONENT_TYPES.has(spell.componentTypeId) &&
        spell.componentId != null && !grantedIds.has(spell.componentId)) return;
    const uses = limitedUseToPool(spell.limitedUse, level, abilities, def.description, def.snippet);
    const source = `${spell.componentTypeId ?? ''}:${spell.componentId ?? ''}:${JSON.stringify(uses)}`;
    const sourceName = spellGrantSource(raw, spell.componentId) ?? 'Spell grant';
    const casting = castingProfile(spell, cls);
    const appendCasting = (entry: SpellEntry) => {
      if (!casting) return;
      const sources = entry.castingSources ??= [];
      if (!sources.some((source) => source.source === casting.source && source.ability === casting.ability)) sources.push(casting);
      entry.ability ??= casting.ability;
    };
    const grantRules = uses ? hiddenOriginSpellRules(raw, spell, resolveForComponent) : '';
    const appendGrantRules = (entry: SpellEntry) => {
      if (grantRules && !entry.summary?.includes(grantRules)) {
        entry.summary = [entry.summary, `**${sourceName} — free casting.** ${grantRules}`].filter(Boolean).join(' ');
      }
    };
    const existing = byName.get(def.name);
    if (existing) {
      // A spell can be both a prepared class spell and a feature-granted free
      // cast; keep the first entry but pick up the limited-use tracker.
      if (uses && !useSources.get(def.name)?.has(source)) {
        (existing.featureUses ??= []).push({ source: sourceName, pool: uses });
        if (!existing.uses) existing.uses = { max: uses.max, ...(uses.recharge ? { recharge: uses.recharge } : {}) };
        else if (existing.uses.recharge === uses.recharge) existing.uses.max += uses.max;
        useSources.get(def.name)?.add(source);
      }
      appendGrantRules(existing);
      appendCasting(existing);
      if (spell.prepared) existing.prepared = true;
      return;
    }
    const entry: SpellEntry = { name: def.name, level: def.level ?? 0 };
    if (def.school) entry.school = def.school;
    const castingTime = spellCastingTime(def.activation);
    if (castingTime) entry.castingTime = castingTime;
    const range = spellRangeLabel(def.range);
    if (range) entry.range = range;
    const components = spellComponents(def.components);
    if (components) entry.components = components;
    const duration = spellDuration(def.duration, def.concentration);
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
    if (spell.prepared) entry.prepared = true;
    const content = artifacts.extract(
      resolveForComponent(spell.componentId)(def.description || def.snippet || ''), def.name, `spell:${def.name}`,
    );
    const higher = /<(?:p|h[1-6])\b[^>]*>\s*(?:<(?:strong|b|em|i)\b[^>]*>\s*)*(?:Using a Higher-Level Spell Slot|At Higher Levels|Cantrip Upgrade)[.:]?/i.exec(content.html);
    let mainRules = higher ? content.html.slice(0, higher.index) : content.html;
    if (higher) {
      entry.upcast = completeRules(content.html.slice(higher.index))
        .replace(/^\**(?:Using a Higher-Level Spell Slot|At Higher Levels|Cantrip Upgrade)[.:]?\**\s*/i, '');
    }
    const lists: NonNullable<SpellEntry['list']>['items'] = [];
    mainRules = mainRules.replace(/<([uo]l)\b[^>]*>[\s\S]*?<\/\1>/gi, (html) => {
      const list = structuredList(html, completeRules);
      if (!list) return html;
      lists.push(...list.items);
      return '';
    });
    if (lists.length) entry.list = { items: lists };
    const rules = completeRules(mainRules);
    if (content.related) entry.related = content.related;
    if (def.components?.includes(3) && def.componentsDescription) entry.material = plainText(def.componentsDescription);
    if (rules) entry.summary = rules;
    appendGrantRules(entry);
    if (uses) {
      entry.uses = { max: uses.max, ...(uses.recharge ? { recharge: uses.recharge } : {}) };
      entry.featureUses = [{ source: sourceName, pool: uses }];
    }
    const ability = abilityKeyById(spell.spellCastingAbilityId);
    if (ability) entry.ability = ability.toUpperCase();
    appendCasting(entry);
    useSources.set(def.name, new Set(uses ? [source] : []));
    byName.set(def.name, entry);
  };
  for (const group of asArray(raw.classSpells)) {
    const cls = asArray(raw.classes).find((entry) => entry.id != null && entry.id === group.characterClassId);
    for (const spell of asArray(group.spells)) add(spell, cls);
  }
  if (raw.spells) {
    const classesByFeature = new Map<number, RawCharacterClass>();
    for (const cls of asArray(raw.classes)) {
      for (const feature of [
        ...asArray(cls.classFeatures).map((entry) => entry.definition),
        ...asArray(cls.definition?.classFeatures),
      ]) {
        if (feature?.id != null && (feature.requiredLevel ?? 0) <= cls.level) classesByFeature.set(feature.id, cls);
      }
    }
    const parents = new Map<number, number>();
    for (const group of Object.values(raw.options ?? {})) {
      for (const option of asArray<RawSelectedOption>(group)) {
        if (option.definition?.id != null && option.componentId != null) parents.set(option.definition.id, option.componentId);
      }
    }
    const owningClass = (spell: RawSpell): RawCharacterClass | undefined => {
      let id = spell.componentId;
      const seen = new Set<number>();
      while (id != null && !seen.has(id)) {
        const cls = classesByFeature.get(id);
        if (cls) return cls;
        seen.add(id);
        id = parents.get(id);
      }
      return undefined;
    };
    for (const [source, group] of Object.entries(raw.spells)) {
      for (const spell of asArray<RawSpell>(group)) add(spell, source === 'class' ? owningClass(spell) : undefined);
    }
  }
  return [...byName.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function spellGrantSource(raw: RawCharacter, componentId: number | null | undefined): string | undefined {
  if (componentId == null) return undefined;
  for (const cls of asArray(raw.classes)) {
    const feature = asArray(cls.classFeatures).find((entry) => entry.definition?.id === componentId)?.definition
      ?? asArray(cls.definition?.classFeatures).find((entry) => entry.id === componentId);
    if (feature?.name) return feature.name;
  }
  const feat = asArray(raw.feats).find((entry) => entry.definition?.id === componentId)?.definition;
  if (feat?.name) return feat.name;
  const trait = asArray(raw.race?.racialTraits).find((entry) => entry.definition?.id === componentId)?.definition;
  if (trait?.name) return trait.name;
  for (const group of Object.values(raw.options ?? {})) {
    const option = asArray<RawSelectedOption>(group).find((entry) => entry.definition?.id === componentId);
    if (option?.definition?.name) return option.definition.name;
  }
  return 'Feature grant';
}

function hiddenOriginSpellRules(raw: RawCharacter, spell: RawSpell, resolve: ComponentResolver): string {
  const options = Object.values(raw.options ?? {}).flatMap((group) => asArray<RawSelectedOption>(group));
  let id = spell.componentId;
  let html = '';
  const seen = new Set<number>();
  while (id != null && !seen.has(id)) {
    seen.add(id);
    const feat = asArray(raw.feats).find((entry) => entry.definition?.id === id);
    if (feat && isDisguiseFeat(feat, raw)) {
      const name = spell.definition?.name?.toLowerCase();
      const sources = html ? [html] : [
        ...options.filter((option) => option.componentId === id)
          .map((option) => option.definition?.description || option.definition?.snippet || ''),
        feat.definition?.description || feat.definition?.snippet || '',
      ];
      const chunks = sources.flatMap((source) => {
        const content = parseFeatureParts(source, resolve(spell.componentId));
        return [content.intro, ...content.parts.map((part) => part.text)];
      });
      return name ? [...new Set(chunks.filter((text) => text.toLowerCase().includes(name)))].join(' ') : '';
    }
    const option = options.find((entry) => entry.definition?.id === id);
    if (!option) return '';
    html ||= option.definition?.description || option.definition?.snippet || '';
    id = option.componentId;
  }
  return '';
}

/** Carried items with quantity and equipped/attuned flags. */
function resolveInventory(raw: RawCharacter): InventoryEntry[] {
  return asArray(raw.inventory)
    .filter((item) => item.definition?.name)
    .map((item) => ({
      name: item.definition!.name!,
      quantity: item.quantity ?? 1,
      equipped: item.equipped === true,
      attuned: item.isAttuned === true,
    }));
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
  abilities: AbilityScore[],
  ...rules: (string | null | undefined)[]
): ResourcePool | undefined {
  if (!limitedUse) return undefined;
  let max = Math.max(0, limitedUse.maxUses ?? 0);
  if (limitedUse.useProficiencyBonus) max = limitedUse.proficiencyBonusOperator === 2
    ? max * proficiencyBonus(level) : max + proficiencyBonus(level);
  const key = abilityKeyById(limitedUse.statModifierUsesId);
  if (key) {
    const modifier = abilities.find((ability) => ability.key === key)?.modifier ?? 0;
    max = limitedUse.operator === 2 ? max * modifier : max + modifier;
  }
  max = Math.floor(max);
  if (!Number.isFinite(max) || max < 1) return undefined;
  const recharge =
    limitedUse.resetType === 1 ? 'SR' : limitedUse.resetType === 2 ? 'LR' : '';
  const pool: ResourcePool = recharge ? { max, recharge } : { max };
  if (recharge) pool.recovery = { kind: 'rest', rest: recharge === 'SR' ? 'short' : 'long' };
  if (recharge === 'LR' && regainsOneOnShortRest(...rules)) {
    pool.recharge = 'SR1_LR';
    pool.recovery = { kind: 'partial-short-full-long', shortRestUses: 1 };
  }
  const text = plainText(rules.filter(Boolean).join(' '));
  const countWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 };
  const alternateRecovery: NonNullable<ResourcePool['alternateRecovery']> = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const restore = /\b(?:restore|regain)\s+(all|a|one|two|three|\d+)\b[^.]*?\buses?\b[^.]*?\bby\s+(?:spending|expending)\s+(.+?)(?:\.|$)/i.exec(sentence);
    const spend = /\bunless\s+you\s+(?:spend|expend)\s+(.+?)\s+(?:\([^)]*\)\s*)?to\s+(?:restore|regain)\b[^.]*?\buses?\b/i.exec(sentence);
    if (!restore && !spend) continue;
    const amount = restore?.[1].toLowerCase() ?? 'one';
    const restores = amount === 'all' ? 'all' : (countWords[amount] ?? Number(amount));
    const cost = (restore?.[2] ?? spend![1]).replace(/\([^)]*no action required[^)]*\)/gi, '')
      .replace(/^(a|an|one|two|three)\b/i, (word) => String(countWords[word.toLowerCase()])).trim();
    if (cost && !alternateRecovery.some((entry) => entry.restores === restores && entry.cost === cost)) {
      alternateRecovery.push({ restores, cost });
    }
  }
  if (alternateRecovery.length) pool.alternateRecovery = alternateRecovery;
  return pool;
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
function resolveResourceMap(raw: RawCharacter, level: number, abilities: AbilityScore[]): Map<number, ResourcePool> {
  const map = new Map<number, ResourcePool>();
  if (!raw.actions) return map;
  for (const group of Object.values(raw.actions)) {
    for (const action of asArray<RawAction>(group)) {
      if (action.componentId == null) continue;
      const pool = limitedUseToPool(action.limitedUse, level, abilities, action.description, action.snippet);
      if (pool) map.set(action.componentId, pool);
    }
  }
  return map;
}

/**
 * Structural placeholder entries in a class's feature list that aren't real
 * features — a stat bump ("Ability Score Improvement"), the subclass CHOICE
 * ("Cleric Subclass"), an epic boon slot, or the class's summary header
 * ("Core Cleric Traits", which just points at the proficiencies table) — so
 * they're dropped to match what D&D Beyond actually lists.
 */
const STRUCTURAL_FEATURE = /Ability Score Improvement| Subclass$|^Epic Boon$|^Core .+ Traits$/;

/**
 * Ability-score-boost features (the "Ability Score Improvement" feat, a
 * background's "… Ability Score Increase(s)", etc.). When such a feature granted
 * ability bonuses we show just those bumps instead of the generic rules text; one
 * that granted none (the generic "Ability Score Increases" rules placeholder)
 * falls through and keeps its own description.
 */
const ABILITY_SCORE_FEATURE = /Ability Score (?:Improvement|Increase)s?$/;

/**
 * A selected option whose name is a bare damage type (e.g. Draconic Sorcery's
 * Elemental Affinity, chosen as "Fire Damage"). Such a choice reads better under
 * its feature's own name — "Elemental Affinity (Fire)" — than the raw label.
 */
const DAMAGE_TYPE_CHOICE =
  /^(Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder) Damage$/i;

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

/**
 * The proficiencies a FEAT granted, keyed by its id in the `feat` modifier
 * group, as a short "Stealth, Perception, Insight" list — the actual skills or
 * tools chosen for a "choose N proficiencies" feat like Skilled, shown in place
 * of its generic "any combination of your choice" rules text. Scoped to the
 * `feat` group so a class/background proficiency grant is never swept in.
 */
function featProficiencies(raw: RawCharacter, componentId: number | undefined): string | undefined {
  if (componentId == null) return undefined;
  const names: string[] = [];
  for (const mod of asArray<RawModifier>(raw.modifiers?.feat)) {
    if (mod.type !== 'proficiency' || mod.componentId !== componentId) continue;
    const name = mod.friendlySubtypeName?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length ? names.join(', ') : undefined;
}

/** Category tag D&D Beyond puts on placeholder "feats" that aren't real feats. */
const DISGUISE_FEAT_TAG = '__DISGUISE_FEAT';

/** Catalog-origin wrappers are not visible feats without an explicit feat pick.
 * Cached option records and nonempty descriptions are not selection evidence. */
function isDisguiseFeat(feat: RawFeat, raw: RawCharacter): boolean {
  const tagged = asArray(feat.definition?.categories).some(
    (category) => category.tagName === DISGUISE_FEAT_TAG,
  );
  const def = feat.definition;
  const choices = raw.choices;
  const selected = def?.id != null &&
    [choices?.class, choices?.race, choices?.feat, choices?.background, choices?.item]
      .some((group) => asArray(group).some((choice) => choice.optionValue === def.id));
  return tagged && !selected;
}

/**
 * Map from a "choose one" feature's id to the option the character selected,
 * built from `raw.options`, never the catalog of available choices. Textless
 * choices still carry meaningful names (for example selected magic item plans).
 */
interface SelectedBenefit {
  id?: number;
  name: string;
  summary?: string;
  html?: string;
  snippet?: string;
}

function selectedOptionsByComponent(
  raw: RawCharacter,
  resolveForComponent: ComponentResolver,
): Map<number, SelectedBenefit[]> {
  const map = new Map<number, SelectedBenefit[]>();
  const options = raw.options;
  if (!options) return map;
  const groups = [options.race, options.class, options.feat, options.background, options.item];
  for (const group of groups) {
    for (const option of asArray(group)) {
      const def = option.definition;
      const id = option.componentId;
      if (id == null || !def?.name) continue;
      const selected = map.get(id) ?? [];
      if (selected.some(({ name }) => name === def.name)) continue;
      const description = /This is a generated .* Option:/i.test(def.description ?? '') ? '' : def.description;
      const html = resolveForComponent(def.id ?? id)(description || def.snippet || '');
      selected.push({
        id: def.id, name: def.name, summary: completeRules(html), html,
        snippet: resolveForComponent(def.id ?? id)(def.snippet || ''),
      });
      map.set(id, selected);
    }
  }
  return map;
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
  const source = resolvePlaceholders ? resolvePlaceholders(raw) : raw;
  const paragraphs: string[] = [];
  let cursor = 0;
  for (const match of source.matchAll(/<(p|ul|ol|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi)) {
    if (match.index > cursor) paragraphs.push(source.slice(cursor, match.index));
    paragraphs.push(match[0]);
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) paragraphs.push(source.slice(cursor));
  const parts: FeaturePart[] = [];
  const introChunks: string[] = [];
  let seenPart = false;
  for (const paragraph of paragraphs) {
    const list = /^\s*<[uo]l\b/i.test(paragraph) ? structuredList(paragraph, completeRules) : undefined;
    if (list) {
      seenPart = true;
      parts.push({ label: '', text: '', list });
      continue;
    }
    const inner = paragraph.replace(/^<(?:p|h[1-6])\b[^>]*>/i, '').replace(/<\/(?:p|h[1-6])>\s*$/i, '');
    // A sub-part header is a bold+italic run at the paragraph start, in either
    // nesting order (`<strong><em>…</em></strong>` or `<em><strong>…</strong></em>`).
    const marker = leadingLabel(inner, completeRules);
    if (marker) {
      seenPart = true;
      parts.push({ label: marker.label, text: marker.rest });
    } else {
      const text = completeRules(inner);
      if (!text) continue;
      if (seenPart) parts.push({ label: '', text });
      else introChunks.push(text);
    }
  }
  return { intro: introChunks.join(' '), parts };
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

/** Features and traits grouped by source, each with its resource + sub-parts. */
type FeatureContent = Omit<FeatureItem, 'name' | 'resource'>;

function resolveFeatures(
  raw: RawCharacter,
  resources: Map<number, ResourcePool>,
  actionNamesByComponent: Map<number, string[]>,
  detailedActionNames: Set<string>,
  resolveForComponent: ComponentResolver,
  actions: CharacterAction[],
  artifacts: RuleArtifacts,
): FeatureGroup[] {
  const optionByComponent = selectedOptionsByComponent(raw, resolveForComponent);
  const grantedSpells = new Map<number, string[]>();
  const ownedIds = grantedFeatureIds(raw);
  const parentByOption = new Map<number, number>();
  for (const group of Object.values(raw.options ?? {})) {
    for (const option of asArray<RawSelectedOption>(group)) {
      if (option.definition?.id != null && option.componentId != null) parentByOption.set(option.definition.id, option.componentId);
    }
  }
  const spells = [
    ...asArray(raw.classSpells).flatMap((group) => asArray(group.spells)),
    ...Object.values(raw.spells ?? {}).flatMap((group) => asArray<RawSpell>(group)),
  ];
  for (const spell of spells) {
    let id = spell.componentId;
    if (id == null || !ownedIds.has(id) || !spell.definition?.name) continue;
    const seen = new Set<number>();
    while (id != null && !seen.has(id)) {
      seen.add(id);
      const names = grantedSpells.get(id) ?? [];
      if (!names.includes(spell.definition.name)) names.push(spell.definition.name);
      grantedSpells.set(id, names);
      id = parentByOption.get(id);
    }
  }
  const normalizedRule = (text: string): string => plainText(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const coveredByActions = (id: number | undefined, text: string): boolean => {
    const key = normalizedRule(text);
    if (!key || id == null) return false;
    const names = actionNamesByComponent.get(id) ?? [];
    return actions.some((action) => names.includes(action.name) &&
      normalizedRule(action.summary ?? '').includes(key));
  };

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
    return (
      actionNamesByComponent
        .get(id)
        ?.some((name) => wordsSubsetMatch(labelWords, significantWords(name))) ?? false
    );
  };
  // A whole feature that IS a real activation whose full effect is spelled out on
  // the Actions card just points there instead of repeating it (e.g. Innate
  // Sorcery -> its Bonus Action). Umbrella/resource features (Channel Divinity)
  // and passive "other" options (Sorcerous Restoration, a Metamagic option) don't
  // qualify, so they keep their own text in the feature list.
  const detailedNameWords = [...detailedActionNames].map(significantWords);
  const isDetailedActionFeature = (name: string, id: number | undefined, content: FeatureContent): boolean => {
    const texts = [content.summary ?? '', ...(content.parts ?? []).map((part) => part.text)].filter(Boolean);
    return texts.length > 0 && !content.parts?.some((part) => part.list || part.table) &&
      texts.every((text) => coveredByActions(id, text)) &&
      detailedNameWords.some((words) => wordsSubsetMatch(significantWords(name), words));
  };

  // A feature's display content: a summary blurb plus optional named sub-parts.
  const contentFor = (
    id: number | undefined,
    snippet: string | null | undefined,
    description: string | null | undefined,
  ): FeatureContent => {
    const resolvePlaceholders = resolveForComponent(id);
    const extracted = artifacts.extract(
      resolvePlaceholders(description || snippet || ''), spellGrantSource(raw, id) ?? 'Feature', id,
    );
    const parsed = parseFeatureParts(extracted.html);
    const parts = parsed.parts;
    let intro = parsed.intro;
    const snippetText = completeRules(resolvePlaceholders(snippet || ''));
    const fullText = normalizedRule(completeRules(extracted.html));
    const supplemental = snippetText.split(/(?<=[.!?])\s+(?=[A-Z*])/)
      .filter((sentence) => sentence && !fullText.includes(normalizedRule(sentence)));
    if (supplemental.length) intro = [intro, ...supplemental].filter(Boolean).join(' ');
    const content: FeatureContent = extracted.related ? { related: extracted.related } : {};
    const sentences = intro.split(/(?<=[.!?])\s+(?=[A-Z*])/);
    const independent = sentences.filter((sentence) => !coveredByActions(id, sentence));
    if (independent.length < sentences.length) {
      intro = independent.join(' ');
      content.related = [...new Set([...(content.related ?? []), 'actions' as const])];
    }
    if (parts.length === 0) {
      if (!intro && content.related?.includes('actions')) {
        content.reference = 'actions';
        content.related = content.related.filter((section) => section !== 'actions');
        if (!content.related.length) delete content.related;
      }
      return intro ? { ...content, summary: intro } : content;
    }
    const shown: FeaturePart[] = [];
    for (const part of parts) {
      if (part.list && part.list.items.every((entry) =>
        coveredByActions(id, [entry.label, entry.text].filter(Boolean).join(' ')))) {
        shown.push({ label: part.label, text: '', reference: 'actions' });
      } else if (part.label && !part.list && !part.table && isActionPart(id, part.label) && coveredByActions(id, part.text)) {
        shown.push({ label: part.label, text: '', reference: 'actions' });
      } else if (!part.label && !part.list && !part.table && coveredByActions(id, part.text)) {
        shown.push({ label: '', text: '', reference: 'actions' });
      } else {
        shown.push(part);
      }
    }
    return { ...content, ...(intro ? { summary: intro } : {}), parts: shown };
  };

  const toItem = (
    name: string,
    id: number | undefined,
    content: FeatureContent,
  ): FeatureItem => {
    const item: FeatureItem = { name, ...content };
    const resource = id != null ? resources.get(id) : undefined;
    if (resource) item.resource = resource;
    const summary = content.summary ? stripRepeatableNote(content.summary) : '';
    if (summary) item.summary = summary;
    else delete item.summary;
    if (content.parts?.length) {
      const parts = content.parts
        .filter((part) => part.label || part.text || part.list || part.table || part.reference)
        .filter(
          (part) =>
            !/^\s*repeatable\b/i.test(part.label ?? '') &&
            !/take this feat more than once/i.test(part.text ?? ''),
        );
      if (parts.length) item.parts = parts;
      else delete item.parts;
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
    selected?: SelectedBenefit,
  ): { name: string | undefined; content: FeatureContent } => {
    // A feature whose whole purpose is a stat bump (the Ability Score Improvement
    // feat, a background's Ability Score Increase(s)): show ONLY the bumps granted,
    // not the generic "one score by 2 or two by 1" rules text. A name-only rules
    // placeholder that granted no bumps falls through and keeps its description.
    if (rawName && ABILITY_SCORE_FEATURE.test(rawName)) {
      const only = abilityScoreIncreases(raw, id);
      if (only) return { name: rawName, content: { summary: only } };
    }

    let name = rawName;
    let content: FeatureContent;
    const chosen = selected ?? (id != null ? optionByComponent.get(id)?.[0] : undefined);
    if (chosen) {
      // A bare damage-type choice (Elemental Affinity -> "Fire Damage") reads
      // better under its feature's own name, e.g. "Elemental Affinity (Fire)".
      const damageType = DAMAGE_TYPE_CHOICE.exec(chosen.name)?.[1];
      name = damageType && rawName ? `${rawName} (${damageType})` : chosen.name;
      content = contentFor(chosen.id ?? id, chosen.snippet, chosen.html);
    } else {
      content = contentFor(id, snippet, description);
    }
    const spellNames = grantedSpells.get(chosen?.id ?? id ?? -1);
    if (spellNames?.length) content.grantedSpells = spellNames;
    if (/^(Spellcasting|Pact Magic)$/.test(rawName ?? '') && content.parts) {
      const cls = asArray(raw.classes).find((entry) =>
        (entry.subclassDefinition?.spellCastingAbilityId ?? entry.definition?.spellCastingAbilityId) != null &&
        [...asArray(entry.classFeatures).map((feature) => feature.definition), ...asArray(entry.definition?.classFeatures)]
          .some((feature) => feature?.id === id));
      const focus = cls ? castingFocus(cls, resolveForComponent) : undefined;
      if (focus) content.parts = content.parts.map((part) =>
        /^(Tools Required|Spellcasting Focus)$/i.test(part.label) && focus.includes(part.text)
          ? { label: part.label, text: '', reference: 'spells' } : part);
    }

    // A feat that grants proficiencies (Skilled and the like) shows the actual
    // skills/tools chosen, not the generic "any combination of your choice" text.
    const proficiencies = featProficiencies(raw, id);
    if (proficiencies) content = { ...content, summary: proficiencies };

    // Any OTHER feature that ALSO grants an ability-score bonus (a half-feat, an
    // origin's fixed increase, …): note the bumps alongside its description.
    const increases = abilityScoreIncreases(raw, id);
    if (increases) {
      content = { ...content, parts: [{ label: '', text: increases }, ...(content.parts ?? [])] };
    }

    // A whole feature that is itself an Actions-card activation just points there
    // — its full text (benefits and all) lives on the action.
    if (name && isDetailedActionFeature(name, id, content)) {
      return { name, content: { ...content, summary: undefined, parts: undefined, reference: 'actions' } };
    }

    return { name, content };
  };

  const resolveAll = (
    id: number | undefined,
    name: string | undefined,
    snippet: string | null | undefined,
    description: string | null | undefined,
  ) => {
    if (name && ABILITY_SCORE_FEATURE.test(name) && abilityScoreIncreases(raw, id)) {
      return [resolve(id, name, snippet, description)];
    }
    const options = id != null ? optionByComponent.get(id) : undefined;
    if (options?.length && options.every((option) => !option.summary || /^Activate\b/i.test(option.name) ||
        ABILITIES.some((ability) => option.name === ability.name))) {
      const content = contentFor(id, snippet, description);
      content.grants = [{ label: 'Selected', items: options.map((option) => option.name) }];
      const spells = grantedSpells.get(id ?? -1);
      if (spells?.length) content.grantedSpells = spells;
      return [{ name, content }];
    }
    if (!options?.length) return [resolve(id, name, snippet, description)];
    const results = options.map((option) => resolve(id, name, snippet, description, option));
    const parent = parseFeatureParts(artifacts.withoutArtifacts(
      resolveForComponent(id)(description || snippet || ''),
    ).replace(/<([uo]l)\b[^>]*>[\s\S]*?<\/\1>/gi, ''));
    const shared = [parent.intro, ...parent.parts.filter((part) =>
      /\b(?:change|replace|switch)\b/i.test(part.text) &&
      /\b(?:chosen|choice|option|model|form)\b/i.test(part.text) &&
      /\brest\b/i.test(part.text)).map((part) => part.text)].filter(Boolean).join(' ');
    const first = results[0];
    if (shared && first && !normalizedRule(JSON.stringify(first.content)).includes(normalizedRule(shared))) {
      first.content.parts = [
        { label: name ?? 'Shared rules', text: shared }, ...(first.content.parts ?? []),
      ];
    }
    return results;
  };

  const classItems: FeatureItem[] = [];
  const seen = new Set<string>();
  const addClass = (
    id: number | undefined,
    rawName: string | undefined,
    snippet: string | null | undefined,
    description: string | null | undefined,
  ) => {
    if (!rawName || STRUCTURAL_FEATURE.test(rawName)) return;
    // Skip a feature whose original name is already shown, so an option-renamed
    // grant (e.g. "Innate Sorcery" -> its "Activate Innate Sorcery" option) isn't
    // listed alongside the plain feature from the class template.
    const identity = id == null ? `${rawName}|${description || snippet || ''}` : String(id);
    const choices = (id == null ? [] : optionByComponent.get(id) ?? [])
      .filter((option) => !/^Activate\b/i.test(option.name))
      .map((option) => `${option.name}|${normalizedRule(option.html ?? '')}`).join('|');
    const rulesIdentity = `${rawName}|${normalizedRule(description || snippet || '')}|${choices}`;
    if (seen.has(identity) || seen.has(rulesIdentity)) return;
    seen.add(identity);
    seen.add(rulesIdentity);
    for (const { name, content } of resolveAll(id, rawName, snippet, description)) {
      if (!name || STRUCTURAL_FEATURE.test(name)) continue;
      classItems.push(toItem(name, id, content));
    }
  };
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.classFeatures)) {
      const def = feature.definition;
      // Granted features carry a `requiredLevel`; skip ones the character hasn't
      // reached yet (e.g. Divine Intervention at level 10 on a level-4 cleric).
      if (def?.requiredLevel != null && def.requiredLevel > cls.level) continue;
      addClass(def?.id, def?.name, def?.snippet, def?.description);
    }
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (feature.requiredLevel == null || feature.requiredLevel <= cls.level) {
        addClass(feature.id, feature.name, feature.snippet, feature.description);
      }
    }
  }

  const racialTraits: FeatureItem[] = [];
  const seenTrait = new Set<string>();
  for (const trait of asArray(raw.race?.racialTraits)) {
    const def = trait.definition;
    if (!def?.name || def.hideInSheet === true || /^Languages?$/i.test(def.name)) continue;
    for (const { name, content } of resolveAll(def.id, def.name, def.snippet, def.description)) {
      if (!name || seenTrait.has(name)) continue;
      seenTrait.add(name);
      racialTraits.push(toItem(name, def.id, content));
    }
  }

  const feats = asArray(raw.feats)
    .filter((feat) => feat.definition?.name && !isDisguiseFeat(feat, raw))
    .flatMap((feat) => {
      const def = feat.definition!;
      return resolveAll(def.id, def.name, def.snippet, def.description)
        .flatMap(({ name, content }) => name ? [toItem(name, def.id, content)] : []);
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

/** A short, readable label (plus optional qualifier) for a defensive modifier. */
function defenceEntry(mod: RawModifier): DefenceEntry {
  const type = mod.friendlyTypeName ?? mod.type ?? '';
  if (mod.type === 'advantage' || mod.type === 'disadvantage') {
    // The restriction is the useful part, so it's the main label; the
    // advantage/disadvantage becomes a "(…)" qualifier before it. With no
    // restriction, fall back to "Advantage on saves".
    return mod.restriction
      ? { text: mod.restriction, qualifier: type }
      : { text: `${type} on saves` };
  }
  const sub = mod.friendlySubtypeName ?? mod.subType ?? '';
  return { text: `${sub} ${type}`.trim() };
}

/** Resistances, immunities, vulnerabilities, and save advantages/disadvantages. */
function resolveDefences(raw: RawCharacter): DefenceEntry[] {
  if (!raw.modifiers) return [];
  const seen = new Set<string>();
  const entries: DefenceEntry[] = [];
  for (const mods of Object.values(raw.modifiers)) {
    for (const mod of asArray<RawModifier>(mods)) {
      const isDamageDefence = DEFENCE_TYPES.has(mod.type ?? '');
      const isSaveMod =
        (mod.type === 'advantage' || mod.type === 'disadvantage') &&
        mod.subType === 'saving-throws';
      if (!isDamageDefence && !isSaveMod) continue;
      const entry = defenceEntry(mod);
      const key = `${entry.text}|${entry.qualifier ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push(entry);
      }
    }
  }
  // Longest first, so the wordier restrictions lead and the terse resistances
  // trail (a stable sort keeps first-seen order among equal lengths).
  const lengthOf = (entry: DefenceEntry) =>
    entry.text.length + (entry.qualifier?.length ?? 0);
  entries.sort((a, b) => lengthOf(b) - lengthOf(a));
  return entries;
}

/** Passive skills shown on the Senses card, by skill key and label. */
const PASSIVE_SENSES: [string, string][] = [
  ['perception', 'Passive Perception'],
  ['investigation', 'Passive Investigation'],
  ['insight', 'Passive Insight'],
];

/** Special-sense modifier subtypes worth surfacing, in display order. */
const SPECIAL_SENSES = ['darkvision', 'blindsight', 'tremorsense', 'truesight'];

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
 * skills, saves) are always shown; the rest auto-hide when empty.
 */
export function normalizeCharacter(raw: RawCharacter): Character {
  const classes = summarizeClasses(raw);
  const level = classes.reduce((total, cls) => total + cls.level, 0);
  const avatarUrl = resolveAvatarUrl(raw);
  const abilities = resolveAbilities(raw);
  const artifacts = new RuleArtifacts(plainText, raw);
  const spellcasting = resolveSpellcasting(raw, abilities, level);
  const resolveForComponent = componentResolvers(raw, abilities, level);
  const skills = resolveSkills(raw, abilities, level);
  const senses = resolveSenses(raw, skills);
  const attacks = resolveAttacks(raw, abilities, level);
  const { actions, resourceComponentIds, actionNamesByComponent, detailedActionNames } =
    resolveActions(
      raw,
      abilities,
      level,
      grantedFeatureIds(raw),
      resolveForComponent,
      artifacts,
    );
  const resources = resolveResourceMap(raw, level, abilities);
  // A feature doesn't need its own checkboxes when the same limited-use pool is
  // already shown on a corresponding action in the Actions card.
  for (const id of resourceComponentIds) resources.delete(id);
  const features = resolveFeatures(
    raw,
    resources,
    actionNamesByComponent,
    detailedActionNames,
    resolveForComponent,
    actions,
    artifacts,
  );
  const featureCount = features.reduce((total, group) => total + group.items.length, 0);
  const spells = resolveSpells(raw, level, abilities, grantedFeatureIds(raw), resolveForComponent, artifacts, spellcasting);
  artifacts.addSelectedCreatures(raw);
  const proficiencies = resolveProficiencies(raw);
  const proficiencyCount = Object.values(proficiencies).reduce((count, entries) => count + entries.length, 0);

  const sections: CharacterSection[] = [
    toSection('portrait', 'Portrait', 0, { alwaysPresent: Boolean(avatarUrl) }),
    toSection('basics', 'Basics', asArray(raw.conditions).length, { alwaysPresent: true }),
    toSection('attributes', 'Attributes', asArray(raw.stats).length, { alwaysPresent: true }),
    toSection('skills', 'Skills', SKILL_COUNT, { alwaysPresent: true }),
    toSection('savingThrows', 'Saves & Defences', SAVE_COUNT, { alwaysPresent: true }),
    toSection('senses', 'Senses', senses.length, { alwaysPresent: true }),
    toSection('proficiencies', 'Proficiencies', proficiencyCount),
    toSection('attacks', 'Attacks', attacks.length),
    toSection('actions', 'Actions', actions.length),
    toSection('spells', 'Spells', spells.length, { alwaysPresent: Boolean(spellcasting) }),
    toSection('inventory', 'Inventory', asArray(raw.inventory).length),
    toSection('wealth', 'Wealth', 0, { alwaysPresent: hasWealth(raw) }),
    toSection('features', 'Features & Traits', featureCount),
    toSection('companions', 'Companions', artifacts.companions.length),
    toSection('tables', 'Tables', artifacts.tables.length),
    toSection('notes', 'Notes', 0, { alwaysPresent: true }),
  ];

  const character: Character = {
    id: raw.id,
    name: raw.name,
    classes,
    level,
    abilities,
    basics: resolveBasics(raw, abilities, level),
    savingThrows: resolveSavingThrows(raw, abilities, level),
    defences: resolveDefences(raw),
    senses,
    skills,
    proficiencies,
    attacks,
    actions,
    spells,
    inventory: resolveInventory(raw),
    wealth: resolveWealth(raw),
    features,
    companions: artifacts.companions,
    ruleTables: artifacts.tables,
    sections,
  };

  const race = raw.race?.fullName ?? raw.race?.baseRaceName;
  if (race) character.race = race;

  const background = raw.background?.definition?.name;
  if (background) character.background = background;

  if (avatarUrl) character.avatarUrl = avatarUrl;

  if (spellcasting) character.spellcasting = spellcasting;

  return character;
}
