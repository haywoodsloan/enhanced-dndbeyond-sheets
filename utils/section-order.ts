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
    'spells',
    'actions',
    'savingThrows',
    'skills',
    'features',
    'proficiencies',
    'inventory',
    'wealth',
  ],
  half: [
    'basics',
    'attributes',
    'portrait',
    'actions',
    'spells',
    'savingThrows',
    'skills',
    'features',
    'inventory',
    'proficiencies',
    'wealth',
  ],
  martial: [
    'basics',
    'attributes',
    'portrait',
    'actions',
    'savingThrows',
    'skills',
    'features',
    'inventory',
    'proficiencies',
    'wealth',
    'spells',
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
