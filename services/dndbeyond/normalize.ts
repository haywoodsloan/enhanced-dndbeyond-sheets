import type { RawAction, RawCharacter, RawSourceMap } from './api-types';
import type {
  Character,
  CharacterClassSummary,
  CharacterSection,
  SectionKey,
} from './model';

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

/** Weapons flagged as attacks plus any action flagged `displayAsAttack`. */
function countAttacks(raw: RawCharacter): number {
  const weaponAttacks = asArray(raw.inventory).filter(
    (item) => item.displayAsAttack === true,
  ).length;

  const actionAttacks = raw.actions
    ? Object.values(raw.actions).reduce<number>(
        (total, entries) =>
          total +
          asArray<RawAction>(entries).filter((action) => action.displayAsAttack === true)
            .length,
        0,
      )
    : 0;

  return weaponAttacks + actionAttacks;
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

function toSection(key: SectionKey, title: string, count: number): CharacterSection {
  return { key, title, count, isEmpty: count === 0 };
}

/**
 * Convert a raw D&D Beyond character payload into the internal `Character`
 * model. Section counts reflect presence of content; exact per-entry rendering
 * is handled in a later phase.
 */
export function normalizeCharacter(raw: RawCharacter): Character {
  const classes = summarizeClasses(raw);
  const level = classes.reduce((total, cls) => total + cls.level, 0);

  const sections: CharacterSection[] = [
    toSection('attributes', 'Attributes', asArray(raw.stats).length),
    toSection('attacks', 'Attacks', countAttacks(raw)),
    toSection('spells', 'Spells', countSpells(raw)),
    toSection('inventory', 'Inventory', asArray(raw.inventory).length),
    toSection('features', 'Features', countFeatures(raw)),
  ];

  const character: Character = {
    id: raw.id,
    name: raw.name,
    classes,
    level,
    sections,
  };

  const race = raw.race?.fullName ?? raw.race?.baseRaceName;
  if (race) character.race = race;

  const background = raw.background?.definition?.name;
  if (background) character.background = background;

  return character;
}
