import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCharacterInPage } from '@/services/dndbeyond/fetch-in-page';

function response(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

describe('fetchCharacterInPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the body on success and includes credentials', async () => {
    const body = { success: true, data: { id: 1 } };
    const fetchMock = vi.fn().mockResolvedValue(response(body));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCharacterInPage('https://example.test/character/1');

    expect(result).toEqual({ ok: true, body });
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/character/1', {
      credentials: 'include',
    });
  });

  it('reports the status on a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response(null, { ok: false, status: 403 })),
    );

    expect(await fetchCharacterInPage('https://example.test')).toEqual({
      ok: false,
      status: 403,
    });
  });

  it('reports an error when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    const result = await fetchCharacterInPage('https://example.test');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('boom');
  });
});
