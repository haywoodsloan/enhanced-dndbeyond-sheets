import type { Character } from './model';
import { readCachedCharacter } from './character-cache';
import { fetchCharacter } from './fetch-character';
import { normalizeCharacter } from './normalize';

/**
 * Load a character by id and normalize it into the internal model.
 *
 * Prefers data the background cached from within the D&D Beyond page (so private
 * characters work); falls back to a direct fetch, which only succeeds for public
 * characters.
 */
export async function loadCharacter(id: number | string): Promise<Character> {
  const cached = await readCachedCharacter(id);
  const raw = cached ?? (await fetchCharacter(id));
  return normalizeCharacter(raw);
}
