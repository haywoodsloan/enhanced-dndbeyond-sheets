import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CharacterFetchError,
  characterServiceUrl,
  fetchCharacter,
} from './fetch-character';

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

describe('characterServiceUrl', () => {
  it('builds the v5 character endpoint url', () => {
    expect(characterServiceUrl(166869100)).toBe(
      'https://character-service.dndbeyond.com/character/v5/character/166869100',
    );
  });
});

describe('fetchCharacter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the data payload on success', async () => {
    const data = { id: 42, name: 'Test', stats: [], classes: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 42, success: true, message: null, data }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCharacter(42);

    expect(fetchMock).toHaveBeenCalledWith(characterServiceUrl(42));
    expect(result).toEqual(data);
  });

  it('throws with the HTTP status when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 404 })),
    );

    await expect(fetchCharacter(1)).rejects.toMatchObject({
      name: 'CharacterFetchError',
      status: 404,
    });
  });

  it('throws when the service reports a failure envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ id: 1, success: false, message: 'nope', data: null }),
        ),
    );

    await expect(fetchCharacter(1)).rejects.toBeInstanceOf(CharacterFetchError);
  });
});
