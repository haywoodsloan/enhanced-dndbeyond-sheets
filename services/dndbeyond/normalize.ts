import {
  ABILITIES,
  SKILLS,
  abilityModifier,
  armorClass,
  conditionName,
  maxHitPoints,
  proficiencyBonus,
  proficiencyContribution,
  type AbilityKey,
  type ArmorCategory,
  type ProficiencyLevel,
} from '@/utils/dnd5e';
import type {
  RawAction,
  RawCharacter,
  RawModifier,
  RawSourceMap,
  RawSpell,
  RawStat,
} from './api-types';
import type {
  AbilityScore,
  Character,
  CharacterAction,
  CharacterBasics,
  CharacterClassSummary,
  CharacterProficiencies,
  CharacterSection,
  Coins,
  FeatureGroup,
  InventoryEntry,
  NoteEntry,
  SavingThrow,
  SectionKey,
  Skill,
  SpellEntry,
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

/** Weapon attacks plus every listed action. */
function resolveActions(raw: RawCharacter): CharacterAction[] {
  const attacks = asArray(raw.inventory)
    .filter((item) => item.displayAsAttack === true && item.definition?.name)
    .map((item) => ({ name: item.definition!.name! }));
  const actions: CharacterAction[] = [];
  if (raw.actions) {
    for (const group of Object.values(raw.actions)) {
      for (const action of asArray<RawAction>(group)) {
        if (action.name) actions.push({ name: action.name });
      }
    }
  }
  return [...attacks, ...actions];
}

/** Known/prepared spells from class spells and other sources, deduped and sorted. */
function resolveSpells(raw: RawCharacter): SpellEntry[] {
  const entries: SpellEntry[] = [];
  const add = (spell: RawSpell) => {
    if (spell.definition?.name != null) {
      entries.push({ name: spell.definition.name, level: spell.definition.level ?? 0 });
    }
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

/** Features and traits grouped by source. */
function resolveFeatures(raw: RawCharacter): FeatureGroup[] {
  const classFeatures: string[] = [];
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (
        feature.name &&
        (feature.requiredLevel == null || feature.requiredLevel <= cls.level)
      ) {
        pushUnique(classFeatures, feature.name);
      }
    }
    for (const feature of asArray(cls.classFeatures)) {
      if (feature.definition?.name && feature.definition.hideInSheet !== true) {
        pushUnique(classFeatures, feature.definition.name);
      }
    }
  }
  const racialTraits = asArray(raw.race?.racialTraits)
    .filter((trait) => trait.definition?.hideInSheet !== true && trait.definition?.name)
    .map((trait) => trait.definition!.name!);
  const feats = asArray(raw.feats)
    .filter((feat) => feat.definition?.name)
    .map((feat) => feat.definition!.name!);

  const groups: FeatureGroup[] = [];
  if (classFeatures.length) groups.push({ label: 'Class Features', items: classFeatures });
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

/** Free-text notes from the character's D&D Beyond notes fields. */
function resolveNotes(raw: RawCharacter): NoteEntry[] {
  const n = raw.notes;
  if (!n) return [];
  const fields: [string | null | undefined, string][] = [
    [n.backstory, 'Backstory'],
    [n.allies, 'Allies'],
    [n.organizations, 'Organizations'],
    [n.enemies, 'Enemies'],
    [n.personalPossessions, 'Personal Possessions'],
    [n.otherHoldings, 'Other Holdings'],
    [n.otherNotes, 'Other Notes'],
  ];
  const entries: NoteEntry[] = [];
  for (const [text, label] of fields) {
    if (typeof text === 'string' && text.trim()) {
      entries.push({ label, text: text.trim() });
    }
  }
  return entries;
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

  const sections: CharacterSection[] = [
    toSection('portrait', 'Portrait', 0, { alwaysPresent: Boolean(avatarUrl) }),
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
    toSection('notes', 'Notes', resolveNotes(raw).length, { alwaysPresent: true }),
  ];

  const abilities = resolveAbilities(raw);

  const character: Character = {
    id: raw.id,
    name: raw.name,
    classes,
    level,
    abilities,
    basics: resolveBasics(raw, abilities, level),
    savingThrows: resolveSavingThrows(raw, abilities, level),
    defences: resolveDefences(raw),
    skills: resolveSkills(raw, abilities, level),
    proficiencies: resolveProficiencies(raw),
    actions: resolveActions(raw),
    spells: resolveSpells(raw),
    inventory: resolveInventory(raw),
    wealth: resolveWealth(raw),
    features: resolveFeatures(raw),
    notes: resolveNotes(raw),
    sections,
  };

  const race = raw.race?.fullName ?? raw.race?.baseRaceName;
  if (race) character.race = race;

  const background = raw.background?.definition?.name;
  if (background) character.background = background;

  if (avatarUrl) character.avatarUrl = avatarUrl;

  return character;
}
