import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CharacterFetchError,
  characterServiceUrl,
  fetchCharacter,
} from '@/services/dndbeyond/fetch-character';
import { getAuthToken } from '@/services/dndbeyond/auth';

vi.mock('@/services/dndbeyond/auth', () => ({
  getAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
}));

const mockedGetAuthToken = vi.mocked(getAuthToken);

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
  beforeEach(() => {
    mockedGetAuthToken.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the data payload for a public character without authenticating', async () => {
    const data = { id: 42, name: 'Test', stats: [], classes: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 42, success: true, message: null, data }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCharacter(42);

    expect(fetchMock).toHaveBeenCalledWith(
      characterServiceUrl(42),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(mockedGetAuthToken).not.toHaveBeenCalled();
    expect(result).toEqual(data);
  });

  it('retries a private character with the user bearer token', async () => {
    const data = { id: 7, name: 'Secret', stats: [], classes: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ id: 7, success: true, message: null, data }));
    vi.stubGlobal('fetch', fetchMock);
    mockedGetAuthToken.mockResolvedValue('bearer-token-123');

    const result = await fetchCharacter(7);

    expect(result).toEqual(data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      credentials: 'include',
      headers: { Authorization: 'Bearer bearer-token-123' },
    });
  });

  it('throws for a private character when the user is not signed in', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(null, { ok: false, status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    mockedGetAuthToken.mockResolvedValue(null);

    await expect(fetchCharacter(7)).rejects.toMatchObject({
      name: 'CharacterFetchError',
      status: 403,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws with the HTTP status for other errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 500 })),
    );

    await expect(fetchCharacter(1)).rejects.toMatchObject({ status: 500 });
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
