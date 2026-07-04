import type { DdbApiResponse, RawCharacter } from './api-types';
import { getAuthToken } from './auth';

const CHARACTER_SERVICE_BASE =
  'https://character-service.dndbeyond.com/character/v5/character';

/** Build the character-service URL for a given character id. */
export function characterServiceUrl(id: number | string): string {
  return `${CHARACTER_SERVICE_BASE}/${id}`;
}

/** Error thrown when a character cannot be fetched or the service reports failure. */
export class CharacterFetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CharacterFetchError';
    this.status = status;
  }
}

/** HTTP statuses returned when a character is private and requires authentication. */
const AUTH_REQUIRED_STATUSES = new Set([401, 403]);

/**
 * Fetch a character's raw data by id from D&D Beyond.
 *
 * Public characters load directly. Private characters return 401/403 and are
 * retried with the signed-in user's bearer token. The session cookie is included
 * on every request (`credentials: 'include'`) so cookie-based auth works too.
 * Runs from an extension context (the sheet page) that holds host permission for
 * the service.
 */
export async function fetchCharacter(id: number | string): Promise<RawCharacter> {
  const url = characterServiceUrl(id);

  let response = await fetch(url, { credentials: 'include' });

  if (AUTH_REQUIRED_STATUSES.has(response.status)) {
    const token = await getAuthToken();
    if (token) {
      response = await fetch(url, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  if (!response.ok) {
    throw new CharacterFetchError(
      `Failed to fetch character ${id}: HTTP ${response.status}`,
      response.status,
    );
  }

  const body = (await response.json()) as DdbApiResponse;

  if (!body.success || body.data == null) {
    throw new CharacterFetchError(
      `Character service returned an error for ${id}: ${body.message ?? 'unknown error'}`,
    );
  }

  return body.data;
}
