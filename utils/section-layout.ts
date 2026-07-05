import type { SectionKey } from '@/services/dndbeyond/model';

/** How wide a section's card is on the 3-column grid. */
export type CardSize = 'small' | 'medium' | 'large';

/** Number of grid columns each size spans. */
export const CARD_SPAN: Record<CardSize, number> = {
  small: 1,
  medium: 2,
  large: 3,
};

/**
 * Default card size per section (small = 1 col, medium = 2, large = 3).
 * Content-heavy sections (spells, features) get larger cards.
 */
const SECTION_SIZE: Record<SectionKey, CardSize> = {
  attributes: 'medium',
  attacks: 'small',
  spells: 'large',
  inventory: 'medium',
  features: 'large',
};

/** The default card size for a section. */
export function sectionSize(key: SectionKey): CardSize {
  return SECTION_SIZE[key];
}
