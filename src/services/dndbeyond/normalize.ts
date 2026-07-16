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
  RawFeat,
  RawInventoryItem,
  RawLimitedUse,
  RawModifier,
  RawSourceMap,
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
  SpellUse,
  WeaponProperty,
} from './model';

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

/** True when any top-level modifier matches the given type and subtype. */
function hasModifier(raw: RawCharacter, type: string, subType: string): boolean {
  if (!raw.modifiers) return false;
  return Object.values(raw.modifiers).some((mods) =>
    asArray<RawModifier>(mods).some(
      (mod) => mod.type === type && mod.subType === subType,
    ),
  );
}

/** True when the character is proficient in a given ability's saving throw. */
function hasSaveProficiency(raw: RawCharacter, abilityName: string): boolean {
  return hasModifier(raw, 'proficiency', `${abilityName.toLowerCase()}-saving-throws`);
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
      sumBonusModifiers(raw, 'saving-throws') +
      sumBonusModifiers(raw, `${meta.name.toLowerCase()}-saving-throws`);
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
  if (hasModifier(raw, 'half-proficiency', skillKey)) return 'half';
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
      modifier: abilityMod + proficiencyContribution(proficiency, prof),
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
 * quotes/dashes plus any numeric `&#…;`), and collapses whitespace.
 */
function plainText(html: string): string {
  return html
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
 * A short blurb from a rules string — enough to actually use the ability, not
 * the full rules dump. Returns the whole text when it's already short (a curated
 * snippet), else keeps as many WHOLE sentences as fit `maxLength` (preferring a
 * real sentence end — a ./!/? before a capital or the end — so mid-sentence
 * abbreviations like "ft." don't cut it short), else a word-boundary cut.
 */
function summarize(
  text: string | null | undefined,
  maxLength = 400,
  resolvePlaceholders?: (text: string) => string,
): string {
  const source = text ?? '';
  const plain = plainText(resolvePlaceholders ? resolvePlaceholders(source) : source);
  if (!plain || plain.length <= maxLength) return plain;
  const slice = plain.slice(0, maxLength);
  const sentences = slice.match(/^[\s\S]*[.!?](?=\s+[A-Z(]|$)/)?.[0];
  if (sentences && sentences.length >= maxLength * 0.5) return sentences.trimEnd();
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`;
}

/**
 * A resolver for D&D Beyond's `{{…}}` dynamic-value placeholders, bound to this
 * character's level and ability modifiers. Handles the common forms —
 * `{{classlevel}}`, `{{modifier:cha}}` (with optional `@min:N` / `#unsigned`
 * flags), and simple `{{(classlevel/2)@rounddown}}` arithmetic — and drops any
 * placeholder it can't resolve (e.g. `{{scalevalue}}`). Modifiers render signed
 * unless `#unsigned`; levels and arithmetic render as plain numbers.
 */
function makePlaceholderResolver(
  abilities: AbilityScore[],
  level: number,
): (text: string) => string {
  const modByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  return (text) =>
    text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_whole, expr: string) => {
      const [beforeHash, format = ''] = expr.split('#');
      const [core, ...flags] = beforeHash.split('@').map((part) => part.trim());
      const modMatch = /^modifier:([a-z]+)/i.exec(core);
      let value: number | undefined;
      if (/^classlevel$/i.test(core)) {
        value = level;
      } else if (modMatch) {
        value = modByKey.get(modMatch[1].slice(0, 3).toLowerCase() as AbilityKey);
      } else {
        // Simple binary arithmetic on the class level, e.g. (classlevel/2).
        const arith = core.replace(/classlevel/gi, String(level));
        const parts = /^\(?\s*(-?\d+)\s*([+\-*/])\s*(-?\d+)\s*\)?$/.exec(arith);
        if (parts) {
          const a = Number(parts[1]);
          const b = Number(parts[3]);
          const op = parts[2];
          value = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
        }
      }
      if (value == null || Number.isNaN(value)) return ''; // unresolved -> drop
      for (const flag of flags) {
        const min = /^min:(-?\d+)/.exec(flag);
        const max = /^max:(-?\d+)/.exec(flag);
        if (min) value = Math.max(value, Number(min[1]));
        else if (max) value = Math.min(value, Number(max[1]));
        else if (/rounddown/i.test(flag)) value = Math.floor(value);
        else if (/roundup/i.test(flag)) value = Math.ceil(value);
      }
      value = Math.round(value);
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
  const attack: Attack = {
    name: def.name!,
    toHit: abilityMod + (isWeaponProficient(raw, def) ? prof : 0) + magic,
  };
  if (def.damage?.diceString) {
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
    attacks.push(weaponAttack(raw, def, modOf, prof));
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

/** The character's primary spellcasting ability id, if any class casts. */
function spellcastingAbilityId(raw: RawCharacter): number | undefined {
  for (const cls of asArray(raw.classes)) {
    const id = cls.definition?.spellCastingAbilityId;
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
    if (FULL_CASTERS.has(name)) total += cls.level;
    else if (HALF_CASTERS.has(name)) total += Math.floor(cls.level / 2);
    else if (name === 'artificer') total += Math.ceil(cls.level / 2);
  }
  return total;
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
  const slots = spellSlotsForCasterLevel(casterLevel(raw));
  while (slots.length && slots[slots.length - 1] === 0) slots.pop();
  return {
    ability: key.toUpperCase(),
    modifier,
    attack: modifier + prof,
    saveDc: 8 + prof + modifier,
    slots,
  };
}

/** Damage line for an action from its dice, ability modifier, and type. */
function actionDamage(
  action: RawAction,
  modByStatId: (id: number | null | undefined) => number,
): DamageInfo | undefined {
  const dice = action.dice?.diceString;
  if (!dice) return undefined;
  const bonus = modByStatId(action.abilityModifierStatId);
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
  resolvePlaceholders: (text: string) => string,
): {
  actions: CharacterAction[];
  resourceComponentIds: Set<number>;
  actionNamesByComponent: Map<number, string[]>;
} {
  const modByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  const modByStatId = (id: number | null | undefined) =>
    modByKey.get(abilityKeyById(id) ?? ('' as AbilityKey)) ?? 0;
  const saveDc = spellSaveDc(raw, abilities, level);

  const actions: CharacterAction[] = [];
  const resourceComponentIds = new Set<number>();
  const actionNamesByComponent = new Map<number, string[]>();
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
        const resource = limitedUseToPool(action.limitedUse, level);
        if (resource) {
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
        const summary = summarize(action.snippet || action.description, 400, resolvePlaceholders);
        if (summary) entry.summary = summary;
        if (action.componentId != null) {
          const names = actionNamesByComponent.get(action.componentId);
          if (names) names.push(action.name);
          else actionNamesByComponent.set(action.componentId, [action.name]);
        }
        actions.push(entry);
      }
    }
  }
  return { actions, resourceComponentIds, actionNamesByComponent };
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
  resolvePlaceholders: (text: string) => string,
): SpellEntry[] {
  const entries: SpellEntry[] = [];
  const add = (spell: RawSpell) => {
    const def = spell.definition;
    if (def?.name == null) return;
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
    const summary = summarize(def.snippet || def.description, 400, resolvePlaceholders);
    if (summary) entry.summary = summary;
    entries.push(entry);
  };
  for (const group of asArray(raw.classSpells)) asArray(group.spells).forEach(add);
  if (raw.spells) {
    for (const group of Object.values(raw.spells)) asArray<RawSpell>(group).forEach(add);
  }
  const seen = new Set<string>();
  return entries
    .filter((entry) => (seen.has(entry.name) ? false : seen.add(entry.name)))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
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
): ResourcePool | undefined {
  if (!limitedUse) return undefined;
  let max = limitedUse.maxUses ?? 0;
  if (max <= 0 && limitedUse.useProficiencyBonus) max = proficiencyBonus(level);
  if (max < 1) return undefined;
  const recharge =
    limitedUse.resetType === 1 ? 'SR' : limitedUse.resetType === 2 ? 'LR' : '';
  return recharge ? { max, recharge } : { max };
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

/**
 * Structural placeholder entries in a class's feature list that aren't real
 * features — a stat bump ("Ability Score Improvement"), the subclass CHOICE
 * ("Cleric Subclass"), an epic boon slot, or the class's summary header
 * ("Core Cleric Traits", which just points at the proficiencies table) — so
 * they're dropped to match what D&D Beyond actually lists.
 */
const STRUCTURAL_FEATURE = /Ability Score Improvement| Subclass$|^Epic Boon$|^Core .+ Traits$/;

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
  resolvePlaceholders: (text: string) => string,
): Map<number, { name: string; summary?: string }> {
  const map = new Map<number, { name: string; summary?: string }>();
  const options = raw.options;
  if (!options) return map;
  const groups = [options.race, options.class, options.feat, options.background, options.item];
  for (const group of groups) {
    for (const option of asArray(group)) {
      const def = option.definition;
      const id = option.componentId;
      if (id == null || !def?.name || !def.snippet?.trim() || map.has(id)) continue;
      map.set(id, {
        name: def.name,
        summary: summarize(def.snippet || def.description, 400, resolvePlaceholders),
      });
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
  const paragraphs =
    source.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ??
    source.split(/\r?\n\s*\r?\n/).filter((chunk) => chunk.trim());
  const parts: FeaturePart[] = [];
  const introChunks: string[] = [];
  let seenPart = false;
  for (const paragraph of paragraphs) {
    const inner = paragraph.replace(/^<p\b[^>]*>/i, '').replace(/<\/p>\s*$/i, '');
    // A sub-part header is a bold+italic run at the paragraph start, in either
    // nesting order (`<strong><em>…</em></strong>` or `<em><strong>…</strong></em>`).
    const marker = inner.match(/^\s*<(strong|em)>\s*<(strong|em)>(.+?)<\/\2>\s*<\/\1>\s*/i);
    if (marker) {
      seenPart = true;
      const label = plainText(marker[3]).replace(/[.:]\s*$/, '').trim();
      if (label) parts.push({ label, text: plainText(inner.slice(marker[0].length)) });
    } else {
      const text = plainText(inner);
      if (!text) continue;
      if (seenPart) parts.push({ label: '', text });
      else introChunks.push(text);
    }
  }
  return { intro: introChunks.join(' '), parts };
}

/**
 * Map each granting feature id to the spells it grants a capped number of free
 * casts of (e.g. Gathered Whispers -> Augury 1/LR). A spell's `componentId` can
 * point at a sub-option (a lineage's spellcasting-ability choice), so resolve it
 * through `raw.options` to the feature that actually offers it.
 */
function spellUsesByComponent(raw: RawCharacter, level: number): Map<number, SpellUse[]> {
  const optionParent = new Map<number, number>();
  const options = raw.options;
  if (options) {
    const groups = [options.race, options.class, options.feat, options.background, options.item];
    for (const group of groups) {
      for (const option of asArray(group)) {
        if (option.definition?.id != null && option.componentId != null) {
          optionParent.set(option.definition.id, option.componentId);
        }
      }
    }
  }
  const resolveTarget = (id: number): number => {
    let current = id;
    for (let hop = 0; hop < 4 && optionParent.has(current); hop += 1) {
      current = optionParent.get(current)!;
    }
    return current;
  };

  const map = new Map<number, SpellUse[]>();
  for (const group of Object.values(raw.spells ?? {})) {
    for (const spell of asArray<RawSpell>(group)) {
      const pool = limitedUseToPool(spell.limitedUse, level);
      const name = spell.definition?.name;
      if (!pool || !name || spell.componentId == null) continue;
      const target = resolveTarget(spell.componentId);
      const list = map.get(target);
      if (list) {
        if (!list.some((use) => use.name === name)) list.push({ name, pool });
      } else {
        map.set(target, [{ name, pool }]);
      }
    }
  }
  return map;
}

/** Features and traits grouped by source, each with its resource + sub-parts. */
function resolveFeatures(
  raw: RawCharacter,
  resources: Map<number, ResourcePool>,
  actionNamesByComponent: Map<number, string[]>,
  spellUses: Map<number, SpellUse[]>,
  resolvePlaceholders: (text: string) => string,
): FeatureGroup[] {
  const optionByComponent = selectedOptionsByComponent(raw, resolvePlaceholders);

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
  const isActionPart = (id: number | undefined, label: string): boolean => {
    if (id == null) return false;
    const labelWords = significantWords(label);
    if (labelWords.length < 2) return false;
    const labelSet = new Set(labelWords);
    return (
      actionNamesByComponent.get(id)?.some((name) => {
        const actionWords = significantWords(name);
        if (actionWords.length < 2 || actionWords[0] !== labelWords[0]) return false;
        const actionSet = new Set(actionWords);
        const [small, large] =
          labelSet.size <= actionSet.size ? [labelSet, actionSet] : [actionSet, labelSet];
        return [...small].every((word) => large.has(word));
      }) ?? false
    );
  };

  // A feature's display content: a summary blurb plus optional named sub-parts.
  const contentFor = (
    id: number | undefined,
    snippet: string | null | undefined,
    description: string | null | undefined,
  ): { summary?: string; parts?: FeaturePart[] } => {
    const { intro, parts } = parseFeatureParts(description || snippet, resolvePlaceholders);
    if (parts.length === 0) {
      const summary = summarize(snippet || description, 400, resolvePlaceholders);
      return summary ? { summary } : {};
    }
    const shown = parts.map((part) =>
      part.label && isActionPart(id, part.label)
        ? { label: part.label, text: '(see Actions)' }
        : part,
    );
    return intro ? { summary: intro, parts: shown } : { parts: shown };
  };

  const toItem = (
    name: string,
    id: number | undefined,
    content: { summary?: string; parts?: FeaturePart[] },
  ): FeatureItem => {
    const item: FeatureItem = { name };
    const resource = id != null ? resources.get(id) : undefined;
    if (resource) item.resource = resource;
    if (content.summary) item.summary = content.summary;
    if (content.parts?.length) item.parts = content.parts;
    const uses = id != null ? spellUses.get(id) : undefined;
    if (uses?.length) item.spellUses = uses;
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
  ): { name: string | undefined; content: { summary?: string; parts?: FeaturePart[] } } => {
    // A feature whose whole purpose is a stat bump (the Ability Score Improvement
    // feat, a background's Ability Score Increase(s)): show ONLY the bumps granted,
    // not the generic "one score by 2 or two by 1" rules text. A name-only rules
    // placeholder that granted no bumps falls through and keeps its description.
    if (rawName && ABILITY_SCORE_FEATURE.test(rawName)) {
      const only = abilityScoreIncreases(raw, id);
      if (only) return { name: rawName, content: { summary: only } };
    }

    let name = rawName;
    let content: { summary?: string; parts?: FeaturePart[] };
    const chosen = id != null ? optionByComponent.get(id) : undefined;
    if (chosen) {
      // A bare damage-type choice (Elemental Affinity -> "Fire Damage") reads
      // better under its feature's own name, e.g. "Elemental Affinity (Fire)".
      const damageType = DAMAGE_TYPE_CHOICE.exec(chosen.name)?.[1];
      name = damageType && rawName ? `${rawName} (${damageType})` : chosen.name;
      content = chosen.summary ? { summary: chosen.summary } : {};
    } else {
      content = contentFor(id, snippet, description);
      // Spellcasting/Pact Magic: drop the sub-parts (cantrips, spell slots,
      // preparing spells, …) that just duplicate the Spells card, keeping the intro.
      if (rawName && SPELLCASTING_FEATURE.test(rawName) && content.parts) {
        content = content.summary ? { summary: content.summary } : {};
      }
    }

    // Any OTHER feature that ALSO grants an ability-score bonus (a half-feat, an
    // origin's fixed increase, …): note the bumps alongside its description.
    const increases = abilityScoreIncreases(raw, id);
    if (increases) {
      content = { ...content, parts: [{ label: '', text: increases }, ...(content.parts ?? [])] };
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
  ) => {
    // Skip a feature whose original name is already shown, so an option-renamed
    // grant (e.g. "Innate Sorcery" -> its "Activate Innate Sorcery" option) isn't
    // listed alongside the plain feature from the class template.
    if (rawName && seen.has(rawName)) return;
    const { name, content } = resolve(id, rawName, snippet, description);
    if (!name || seen.has(name) || STRUCTURAL_FEATURE.test(name)) return;
    if (rawName) seen.add(rawName);
    seen.add(name);
    classItems.push(toItem(name, id, content));
  };
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (feature.requiredLevel == null || feature.requiredLevel <= cls.level) {
        addClass(feature.id, feature.name, feature.snippet, feature.description);
      }
    }
    for (const feature of asArray(cls.classFeatures)) {
      const def = feature.definition;
      if (def?.hideInSheet === true) continue;
      // Granted features carry a `requiredLevel`; skip ones the character hasn't
      // reached yet (e.g. Divine Intervention at level 10 on a level-4 cleric).
      if (def?.requiredLevel != null && def.requiredLevel > cls.level) continue;
      addClass(def?.id, def?.name, def?.snippet, def?.description);
    }
  }

  const racialTraits: FeatureItem[] = [];
  const seenTrait = new Set<string>();
  for (const trait of asArray(raw.race?.racialTraits)) {
    const def = trait.definition;
    if (!def?.name || def.hideInSheet === true) continue;
    const { name, content } = resolve(def.id, def.name, def.snippet, def.description);
    if (!name || seenTrait.has(name)) continue;
    seenTrait.add(name);
    racialTraits.push(toItem(name, def.id, content));
  }

  const feats = asArray(raw.feats)
    .filter((feat) => feat.definition?.name && !isDisguiseFeat(feat))
    .map((feat) => {
      const def = feat.definition!;
      const { name, content } = resolve(def.id, def.name, def.snippet, def.description);
      return toItem(name!, def.id, content);
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

/** A short, readable label for a defensive modifier. */
function defenceLabel(mod: RawModifier): string {
  const type = mod.friendlyTypeName ?? mod.type ?? '';
  if (mod.type === 'advantage' || mod.type === 'disadvantage') {
    return mod.restriction ? `${type} on saves (${mod.restriction})` : `${type} on saves`;
  }
  const sub = mod.friendlySubtypeName ?? mod.subType ?? '';
  return `${sub} ${type}`.trim();
}

/** Resistances, immunities, vulnerabilities, and save advantages/disadvantages. */
function resolveDefences(raw: RawCharacter): string[] {
  if (!raw.modifiers) return [];
  const labels = new Set<string>();
  for (const mods of Object.values(raw.modifiers)) {
    for (const mod of asArray<RawModifier>(mods)) {
      const isDamageDefence = DEFENCE_TYPES.has(mod.type ?? '');
      const isSaveMod =
        (mod.type === 'advantage' || mod.type === 'disadvantage') &&
        mod.subType === 'saving-throws';
      if (isDamageDefence || isSaveMod) labels.add(defenceLabel(mod));
    }
  }
  return [...labels];
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
  const resolvePlaceholders = makePlaceholderResolver(abilities, level);
  const skills = resolveSkills(raw, abilities, level);
  const senses = resolveSenses(raw, skills);
  const attacks = resolveAttacks(raw, abilities, level);
  const { actions, resourceComponentIds, actionNamesByComponent } = resolveActions(
    raw,
    abilities,
    level,
    grantedFeatureIds(raw),
    resolvePlaceholders,
  );
  const resources = resolveResourceMap(raw, level);
  // A feature doesn't need its own checkboxes when the same limited-use pool is
  // already shown on a corresponding action in the Actions card.
  for (const id of resourceComponentIds) resources.delete(id);
  const features = resolveFeatures(
    raw,
    resources,
    actionNamesByComponent,
    spellUsesByComponent(raw, level),
    resolvePlaceholders,
  );
  const featureCount = features.reduce((total, group) => total + group.items.length, 0);

  const sections: CharacterSection[] = [
    toSection('portrait', 'Portrait', 0, { alwaysPresent: Boolean(avatarUrl) }),
    toSection('basics', 'Basics', asArray(raw.conditions).length, { alwaysPresent: true }),
    toSection('attributes', 'Attributes', asArray(raw.stats).length, { alwaysPresent: true }),
    toSection('skills', 'Skills', SKILL_COUNT, { alwaysPresent: true }),
    toSection('savingThrows', 'Saves & Defences', SAVE_COUNT, { alwaysPresent: true }),
    toSection('senses', 'Senses', senses.length, { alwaysPresent: true }),
    toSection('proficiencies', 'Proficiencies', countProficiencies(raw)),
    toSection('attacks', 'Attacks', attacks.length),
    toSection('actions', 'Actions', actions.length),
    toSection('spells', 'Spells', countSpells(raw)),
    toSection('inventory', 'Inventory', asArray(raw.inventory).length),
    toSection('wealth', 'Wealth', 0, { alwaysPresent: hasWealth(raw) }),
    toSection('features', 'Features & Traits', featureCount),
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
    proficiencies: resolveProficiencies(raw),
    attacks,
    actions,
    spells: resolveSpells(raw, level, resolvePlaceholders),
    inventory: resolveInventory(raw),
    wealth: resolveWealth(raw),
    features,
    sections,
  };

  const race = raw.race?.fullName ?? raw.race?.baseRaceName;
  if (race) character.race = race;

  const background = raw.background?.definition?.name;
  if (background) character.background = background;

  if (avatarUrl) character.avatarUrl = avatarUrl;

  const spellcasting = resolveSpellcasting(raw, abilities, level);
  if (spellcasting) character.spellcasting = spellcasting;

  return character;
}
