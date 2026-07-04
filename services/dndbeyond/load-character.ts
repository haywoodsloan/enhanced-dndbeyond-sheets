import type { Character } from './model';
import { getAuthToken } from './auth-token';
import { fetchCharacter } from './fetch-character';
import { normalizeCharacter } from './normalize';

/**
 * Load a character by id and normalize it into the internal model.
 *
 * Includes the user's captured `Authorization` header so private characters
 * load; without a captured token the request is unauthenticated and only public
 * characters succeed.
 */
export async function loadCharacter(id: number | string): Promise<Character> {
  const authorization = await getAuthToken();
  const raw = await fetchCharacter(id, { authorization });
  return normalizeCharacter(raw);
}
