import type { DdbApiResponse, RawCharacter } from './api-types';

const CHARACTER_SERVICE_BASE =
  'https://character-service.dndbeyond.com/character/v5/character';

/** Build the public character-service URL for a given character id. */
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

/**
 * Fetch a character's raw data by id from D&D Beyond's public character-service
 * endpoint. The character must be set to public. Intended to run in the
 * background script, which holds the host permission for the service.
 */
export async function fetchCharacter(id: number | string): Promise<RawCharacter> {
  const response = await fetch(characterServiceUrl(id));

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
