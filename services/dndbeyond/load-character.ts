import type { Character } from './model';
import { fetchCharacter } from './fetch-character';
import { normalizeCharacter } from './normalize';

/** Fetch a character by id from D&D Beyond and normalize it into the internal model. */
export async function loadCharacter(id: number | string): Promise<Character> {
  const raw = await fetchCharacter(id);
  return normalizeCharacter(raw);
}
