import type { DdbApiResponse, RawCharacter } from './api-types';

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

export interface FetchCharacterOptions {
  /**
   * `Authorization` header value (e.g. "Bearer …") captured from the user's own
   * D&D Beyond session. Required for private characters; omit for public ones.
   */
  authorization?: string | null;
}

/**
 * Fetch a character's raw data by id from D&D Beyond.
 *
 * Public characters load without auth. Private characters require the user's
 * `Authorization` header — captured from the page's own request — passed via
 * `options.authorization`. `credentials: 'include'` additionally sends the
 * browser session cookie.
 */
export async function fetchCharacter(
  id: number | string,
  options: FetchCharacterOptions = {},
): Promise<RawCharacter> {
  const headers: Record<string, string> = {};
  if (options.authorization) {
    headers.Authorization = options.authorization;
  }

  const response = await fetch(characterServiceUrl(id), {
    credentials: 'include',
    headers,
  });

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
