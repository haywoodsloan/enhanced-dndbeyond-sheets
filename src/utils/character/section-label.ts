import type { SectionKey } from '@/services/dndbeyond/model';

const SECTION_LABELS: Record<SectionKey, string> = {
  portrait: 'Portrait',
  basics: 'Basics',
  attributes: 'Attributes',
  skills: 'Skills',
  savingThrows: 'Saves & Defences',
  senses: 'Senses',
  proficiencies: 'Proficiencies',
  attacks: 'Attacks',
  actions: 'Actions',
  spells: 'Spells',
  inventory: 'Inventory',
  wealth: 'Wealth',
  features: 'Features & Traits',
  notes: 'Notes',
};

/** User-facing label for a character-sheet section. */
export function sectionLabel(section: SectionKey): string {
  return SECTION_LABELS[section];
}