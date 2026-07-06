import { readFileSync } from 'node:fs';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCharacter } from '@/services/dndbeyond/load-character';
import { getAuthToken, setAuthToken } from '@/services/dndbeyond/auth-token';

const noctData = JSON.parse(readFileSync('tests/fixtures/noct.json', 'utf-8'));

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

describe('loadCharacter', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches with the captured authorization token and normalizes', async () => {
    await setAuthToken('Bearer tok');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: noctData.id, success: true, message: null, data: noctData }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const character = await loadCharacter(166869100);

    expect(character.name).toBe('Noct');
    expect(character.classes).toEqual([
      { name: 'Cleric', level: 4, subclass: 'Grave Domain' },
    ]);
    expect(character.sections.map((section) => section.key)).toEqual([
      'portrait',
      'basics',
      'attributes',
      'skills',
      'savingThrows',
      'proficiencies',
      'actions',
      'spells',
      'inventory',
      'wealth',
      'features',
      'notes',
    ]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('fetches without an auth header when no token is captured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: noctData.id, success: true, message: null, data: noctData }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const character = await loadCharacter(166869100);

    expect(character.name).toBe('Noct');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({});
  });

  it('propagates fetch failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 403 })),
    );

    await expect(loadCharacter(1)).rejects.toThrow();
  });

  it('clears the captured token when the fetch is rejected (403)', async () => {
    await setAuthToken('Bearer stale');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 403 })),
    );

    await expect(loadCharacter(166869100)).rejects.toThrow();
    expect(await getAuthToken()).toBeNull();
  });
});
