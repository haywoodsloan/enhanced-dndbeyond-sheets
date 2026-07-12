import {
  ABILITIES,
  SKILLS,
  abilityKeyById,
  abilityModifier,
  armorClass,
  conditionName,
  damageTypeName,
  maxHitPoints,
  proficiencyBonus,
  proficiencyContribution,
  spellSlotsForCasterLevel,
  type AbilityKey,
  type ArmorCategory,
  type ProficiencyLevel,
} from '@/utils/character/dnd5e';
import type {
  RawAction,
  RawCharacter,
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
  InventoryEntry,
  NoteEntry,
  ResourcePool,
  SavingThrow,
  SectionKey,
  SenseEntry,
  Skill,
  SpellEntry,
  Spellcasting,
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

/** One weapon's attack line: to-hit + damage + range + property notes. */
function weaponAttack(
  raw: RawCharacter,
  def: WeaponDef,
  modOf: (key: AbilityKey) => number,
  prof: number,
): Attack {
  const properties = asArray(def.properties)
    .map((property) => property.name)
    .filter((name): name is string => Boolean(name));
  const ranged = def.attackType === RANGED_WEAPON;
  const finesse = properties.includes('Finesse');
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
    ranged || properties.includes('Thrown')
      ? `${def.range ?? 0}/${def.longRange ?? def.range ?? 0} ft.`
      : `${def.range ?? 5} ft.`;
  if (properties.length) attack.notes = properties;
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
 * Real action-economy options (Action / Bonus Action / Reaction) from every
 * source, deduped, each enriched with its limited-use checkboxes, damage, save,
 * and range. Weapon attacks now live in the Attacks card, and passive / special
 * / no-action riders — which D&D Beyond doesn't list as actions — are dropped so
 * the card mirrors the site instead of every internal entry.
 */
function resolveActions(
  raw: RawCharacter,
  abilities: AbilityScore[],
  level: number,
): CharacterAction[] {
  const modByKey = new Map(abilities.map((ability) => [ability.key, ability.modifier]));
  const modByStatId = (id: number | null | undefined) =>
    modByKey.get(abilityKeyById(id) ?? ('' as AbilityKey)) ?? 0;
  const saveDc = spellSaveDc(raw, abilities, level);

  const actions: CharacterAction[] = [];
  const seen = new Set<string>();
  if (raw.actions) {
    for (const group of Object.values(raw.actions)) {
      for (const action of asArray<RawAction>(group)) {
        const category = actionCategory(action.activation?.activationType);
        if (!action.name || category === 'other' || seen.has(action.name)) continue;
        seen.add(action.name);

        const entry: CharacterAction = { name: action.name, category };
        const resource = limitedUseToPool(action.limitedUse, level);
        if (resource) entry.resource = resource;
        const damage = actionDamage(action, modByStatId);
        if (damage) entry.damage = damage;
        const saveKey = abilityKeyById(action.saveStatId);
        if (saveKey) {
          entry.save = `DC ${action.fixedSaveDc ?? saveDc} ${saveKey.toUpperCase()}`;
        }
        const range = action.range?.range;
        if (range) entry.range = `${range} ft.`;
        actions.push(entry);
      }
    }
  }
  return actions;
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
function spellDamage(def: RawSpellDefinition): DamageInfo | undefined {
  const mod = asArray(def.modifiers).find(
    (entry) => entry.type === 'damage' && entry.die?.diceString,
  );
  if (!mod?.die?.diceString) return undefined;
  const damage: DamageInfo = { dice: mod.die.diceString };
  if (mod.friendlySubtypeName) damage.type = mod.friendlySubtypeName;
  const higher = asArray(def.atHigherLevels?.higherLevelDefinitions).find(
    (entry) => entry.dice?.diceString,
  );
  if (higher?.dice?.diceString) damage.scaling = `+${higher.dice.diceString}/slot`;
  else if (def.scaleType === 'characterlevel') damage.scaling = 'scales with level';
  return damage;
}

/** Known/prepared spells from class spells and other sources, deduped and sorted. */
function resolveSpells(raw: RawCharacter): SpellEntry[] {
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
    const damage = spellDamage(def);
    if (damage) entry.damage = damage;
    if (spell.prepared) entry.prepared = true;
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
 * ("Cleric Subclass"), or an epic boon slot — so they're dropped to match what
 * D&D Beyond actually lists.
 */
const STRUCTURAL_FEATURE = /Ability Score Improvement| Subclass$|^Epic Boon$/;

/** Features and traits grouped by source, each with its limited-use resource. */
function resolveFeatures(
  raw: RawCharacter,
  resources: Map<number, ResourcePool>,
): FeatureGroup[] {
  const toItem = (name: string, id: number | undefined): FeatureItem => {
    const resource = id != null ? resources.get(id) : undefined;
    return resource ? { name, resource } : { name };
  };

  const classItems: FeatureItem[] = [];
  const seen = new Set<string>();
  const addClass = (name: string | undefined, id: number | undefined) => {
    if (!name || seen.has(name) || STRUCTURAL_FEATURE.test(name)) return;
    seen.add(name);
    classItems.push(toItem(name, id));
  };
  for (const cls of asArray(raw.classes)) {
    for (const feature of asArray(cls.definition?.classFeatures)) {
      if (feature.requiredLevel == null || feature.requiredLevel <= cls.level) {
        addClass(feature.name, feature.id);
      }
    }
    for (const feature of asArray(cls.classFeatures)) {
      if (feature.definition?.hideInSheet !== true) {
        addClass(feature.definition?.name, feature.definition?.id);
      }
    }
  }

  const racialTraits: FeatureItem[] = [];
  const seenTrait = new Set<string>();
  for (const trait of asArray(raw.race?.racialTraits)) {
    const name = trait.definition?.name;
    if (!name || trait.definition?.hideInSheet === true || seenTrait.has(name)) continue;
    seenTrait.add(name);
    racialTraits.push(toItem(name, trait.definition?.id));
  }

  const feats = asArray(raw.feats)
    .filter((feat) => feat.definition?.name)
    .map((feat) => toItem(feat.definition!.name!, feat.definition?.id));

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

/** Free-text notes from the character's D&D Beyond notes fields. */
function resolveNotes(raw: RawCharacter): NoteEntry[] {
  const n = raw.notes;
  if (!n) return [];
  const fields: [string | null | undefined, string][] = [
    [n.backstory, 'Backstory'],
    [n.allies, 'Allies'],
    [n.organizations, 'Organizations'],
    [n.enemies, 'Enemies'],
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
  const skills = resolveSkills(raw, abilities, level);
  const senses = resolveSenses(raw, skills);
  const attacks = resolveAttacks(raw, abilities, level);
  const actions = resolveActions(raw, abilities, level);
  const resources = resolveResourceMap(raw, level);
  const features = resolveFeatures(raw, resources);
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
    toSection('notes', 'Notes', resolveNotes(raw).length, { alwaysPresent: true }),
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
    spells: resolveSpells(raw),
    inventory: resolveInventory(raw),
    wealth: resolveWealth(raw),
    features,
    notes: resolveNotes(raw),
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
