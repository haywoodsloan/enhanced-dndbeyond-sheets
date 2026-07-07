import type {
  Character,
  CharacterSection,
  SectionKey,
} from '@/services/dndbeyond/model';

type ClassStyle = 'caster' | 'half' | 'martial';

/** Full spellcasting classes — spells lead their layout. */
const CASTER_CLASSES = new Set([
  'wizard',
  'sorcerer',
  'cleric',
  'druid',
  'bard',
  'warlock',
]);

/** Half / partial casters — attacks and spells both feature prominently. */
const HALF_CASTER_CLASSES = new Set(['paladin', 'ranger', 'artificer']);

/** Default section priority (best first) for each play style. */
const STYLE_ORDER: Record<ClassStyle, SectionKey[]> = {
  caster: [
    'basics',
    'attributes',
    'portrait',
    'skills',
    'savingThrows',
    'senses',
    'proficiencies',
    'wealth',
    'spells',
    'actions',
    'features',
    'inventory',
    'notes',
  ],
  half: [
    'basics',
    'attributes',
    'portrait',
    'skills',
    'savingThrows',
    'senses',
    'proficiencies',
    'wealth',
    'actions',
    'spells',
    'features',
    'inventory',
    'notes',
  ],
  martial: [
    'basics',
    'attributes',
    'portrait',
    'skills',
    'savingThrows',
    'senses',
    'proficiencies',
    'wealth',
    'actions',
    'features',
    'inventory',
    'spells',
    'notes',
  ],
};

/** Pick the layout style from the character's highest-level class. */
function classStyle(character: Character): ClassStyle {
  const primary = [...character.classes].sort((a, b) => b.level - a.level)[0];
  const name = primary?.name.toLowerCase() ?? '';
  if (CASTER_CLASSES.has(name)) return 'caster';
  if (HALF_CASTER_CLASSES.has(name)) return 'half';
  return 'martial';
}

/**
 * Order a character's sections for the default layout: class-aware priority,
 * with empty sections moved to the end (auto-hidden) while keeping their
 * relative order.
 */
export function defaultSectionOrder(character: Character): CharacterSection[] {
  const order = STYLE_ORDER[classStyle(character)];
  const rankOf = (section: CharacterSection): number => {
    const index = order.indexOf(section.key);
    return index === -1 ? order.length : index;
  };

  const ranked = character.sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => rankOf(a.section) - rankOf(b.section) || a.index - b.index)
    .map((entry) => entry.section);

  const nonEmpty = ranked.filter((section) => !section.isEmpty);
  const empty = ranked.filter((section) => section.isEmpty);
  return [...nonEmpty, ...empty];
}

/**
 * Reorder `base` to honor a user's saved section order. Keys listed in `saved`
 * lead, in that order; any section not in `saved` keeps its relative position
 * from `base`, appended after the saved ones. An empty `saved` returns `base`
 * unchanged (fall back to the class-aware default).
 */
export function applySavedOrder(
  base: CharacterSection[],
  saved: SectionKey[],
): CharacterSection[] {
  if (saved.length === 0) return base;
  const rank = new Map(saved.map((key, index) => [key, index]));
  return base
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const ra = rank.get(a.section.key);
      const rb = rank.get(b.section.key);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.section);
}

/**
 * Move the section at `from` to index `to` (drag-reorder). Returns a new array,
 * or the same array for a no-op or an out-of-range index.
 */
export function moveSectionByIndex(
  sections: CharacterSection[],
  from: number,
  to: number,
): CharacterSection[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= sections.length ||
    to >= sections.length
  ) {
    return sections;
  }
  const result = [...sections];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

/**
 * Translate a drag within the VISIBLE (non-hidden) subset into a move over the
 * FULL ordered list. `fromVisible`/`toVisible` index the sections that remain
 * after removing the `hidden` keys; the dragged section lands in the target
 * visible section's slot. Returns a new array, or the same array for a no-op.
 */
export function moveVisibleByIndex(
  sections: CharacterSection[],
  hidden: SectionKey[],
  fromVisible: number,
  toVisible: number,
): CharacterSection[] {
  const hiddenSet = new Set(hidden);
  const visible = sections.filter((section) => !hiddenSet.has(section.key));
  const fromKey = visible[fromVisible]?.key;
  const toKey = visible[toVisible]?.key;
  if (fromKey === undefined || toKey === undefined) return sections;
  const from = sections.findIndex((section) => section.key === fromKey);
  const to = sections.findIndex((section) => section.key === toKey);
  return moveSectionByIndex(sections, from, to);
}
