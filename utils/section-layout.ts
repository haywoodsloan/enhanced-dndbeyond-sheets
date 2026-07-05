import type { SectionKey } from '@/services/dndbeyond/model';

/** How wide a section's card is on the 3-column grid (spans 1/2/3 columns). */
export type CardSize = 'small' | 'medium' | 'large';

/**
 * Default card size per section (small = 1 col, medium = 2, large = 3).
 * Content-heavy sections (spells, features) get larger cards.
 */
const SECTION_SIZE: Record<SectionKey, CardSize> = {
  basics: 'large',
  attributes: 'medium',
  skills: 'large',
  savingThrows: 'medium',
  proficiencies: 'medium',
  actions: 'large',
  spells: 'large',
  inventory: 'large',
  wealth: 'small',
  features: 'large',
};

/** The default card size for a section. */
export function sectionSize(key: SectionKey): CardSize {
  return SECTION_SIZE[key];
}
