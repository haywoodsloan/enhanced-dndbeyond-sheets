import type { Character } from './model';
import { clearAuthToken, getAuthToken } from './auth-token';
import { CharacterFetchError, fetchCharacter } from './fetch-character';
import { normalizeCharacter } from './normalize';
import { debugLog } from '@/utils/debug';

/**
 * Load a character by id and normalize it into the internal model.
 *
 * Includes the user's captured `Authorization` header so private characters
 * load; without a captured token the request is unauthenticated and only public
 * characters succeed. A rejected token (401/403) is cleared so we never retain
 * or re-send a bad credential.
 */
export async function loadCharacter(id: number | string): Promise<Character> {
  debugLog('sheet', 'loadCharacter start', { id });
  const authorization = await getAuthToken();
  try {
    const character = normalizeCharacter(await fetchCharacter(id, { authorization }));
    debugLog('sheet', 'loadCharacter done', {
      id,
      name: character.name,
      sections: character.sections.length,
    });
    return character;
  } catch (error) {
    if (
      authorization &&
      error instanceof CharacterFetchError &&
      (error.status === 401 || error.status === 403)
    ) {
      debugLog('sheet', 'clearing rejected token', { status: error.status });
      await clearAuthToken();
    }
    throw error;
  }
}
