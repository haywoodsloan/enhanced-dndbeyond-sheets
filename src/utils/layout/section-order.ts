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

/**
 * Default section priority (best first) for each play style. All styles share
 * the same lead — vitals (basics, attributes, portrait) then the at-a-glance
 * checks (skills, saves, senses, proficiencies) — and the same reference tail —
 * features, then gear (inventory, wealth), then the blank notes page. Only the
 * combat/magic block in the middle is class-specific. Companion stat blocks stay
 * beside their likely owning combat card, while Tables follows Features as its
 * supporting reference appendix.
 */
const STYLE_ORDER: Record<ClassStyle, SectionKey[]> = {
  // Full casters: spells and their summons first, then class actions and a
  // backup weapon.
  caster: [
    'basics',
    'attributes',
    'portrait',
    'skills',
    'savingThrows',
    'senses',
    'proficiencies',
    'spells',
    'companions',
    'actions',
    'attacks',
    'features',
    'tables',
    'inventory',
    'wealth',
    'notes',
  ],
  // Half casters lean martial: weapon attacks lead, spells and their summons
  // support, then actions.
  half: [
    'basics',
    'attributes',
    'portrait',
    'skills',
    'savingThrows',
    'senses',
    'proficiencies',
    'attacks',
    'spells',
    'companions',
    'actions',
    'features',
    'tables',
    'inventory',
    'wealth',
    'notes',
  ],
  // Martials: weapon attacks then actions; spells (subclass casters) follow and
  // auto-hide to the end when the character has none.
  martial: [
    'basics',
    'attributes',
    'portrait',
    'skills',
    'savingThrows',
    'senses',
    'proficiencies',
    'attacks',
    'actions',
    'companions',
    'spells',
    'features',
    'tables',
    'inventory',
    'wealth',
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
    // The default order runs before any spell-card expansion, so every key is a
    // fixed SectionKey here; the cast satisfies the SectionKey[] lookup.
    const index = order.indexOf(section.key as SectionKey);
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
