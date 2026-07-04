import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, getAuthToken } from '@/services/dndbeyond/auth';

const COBALT_TOKEN_URL = 'https://auth-service.dndbeyond.com/v1/cobalt-token';

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

describe('getAuthToken', () => {
  beforeEach(() => {
    clearAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges the session cookie for a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: 'tok', ttl: 300 }));
    vi.stubGlobal('fetch', fetchMock);

    const token = await getAuthToken();

    expect(token).toBe('tok');
    expect(fetchMock).toHaveBeenCalledWith(
      COBALT_TOKEN_URL,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('caches the token across calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: 'tok', ttl: 300 }));
    vi.stubGlobal('fetch', fetchMock);

    await getAuthToken();
    await getAuthToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after clearAuthToken', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: 'tok', ttl: 300 }));
    vi.stubGlobal('fetch', fetchMock);

    await getAuthToken();
    clearAuthToken();
    await getAuthToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when the user is not signed in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 401 })),
    );

    expect(await getAuthToken()).toBeNull();
  });

  it('returns null when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    expect(await getAuthToken()).toBeNull();
  });
});
