import type { Character } from '@/services/dndbeyond/model';

/**
 * The summary line for a character: race and classes joined with a middot, e.g.
 * "Elf · Cleric 4 (Grave Domain)" or "Fighter 3 / Wizard 2" (multiclass). The
 * race is omitted when absent.
 */
export function characterSubtitle(character: Character): string {
  const classes = character.classes
    .map((cls) =>
      cls.subclass ? `${cls.name} ${cls.level} (${cls.subclass})` : `${cls.name} ${cls.level}`,
    )
    .join(' / ');
  return [character.race, classes].filter(Boolean).join(' · ');
}
