import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mockStorageLocks } from '../utils/settings/storage-locks';
import {
  clearAuthToken,
  extractAuthorization,
  getAuthToken,
  setAuthToken,
} from '@/services/dndbeyond/auth-token';

describe('extractAuthorization', () => {
  it('finds the Authorization header case-insensitively', () => {
    expect(
      extractAuthorization([
        { name: 'Accept', value: 'application/json' },
        { name: 'authorization', value: 'Bearer abc.def' },
      ]),
    ).toBe('Bearer abc.def');
  });

  it('returns null when there is no Authorization header', () => {
    expect(extractAuthorization([{ name: 'Accept', value: '*/*' }])).toBeNull();
    expect(extractAuthorization(undefined)).toBeNull();
  });
});

describe('auth token store', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    mockStorageLocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('stores and reads the authorization header value', async () => {
    await setAuthToken('Bearer abc.def');
    expect(await getAuthToken()).toBe('Bearer abc.def');
  });

  it('returns null when no token is stored', async () => {
    expect(await getAuthToken()).toBeNull();
  });

  it('coordinates a capture from another context with compare-and-remove', async () => {
    await setAuthToken('old-credential');
    const read = fakeBrowser.storage.session.get.bind(fakeBrowser.storage.session);
    let release!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(fakeBrowser.storage.session, 'get').mockImplementationOnce(async (key) => {
      const snapshot = await read(key);
      await paused;
      return snapshot;
    });
    vi.resetModules();
    const otherContext = await import('@/services/dndbeyond/auth-token');
    const clearing = clearAuthToken('old-credential');
    await flushPromises();
    const capture = otherContext.setAuthToken('new-credential');
    try {
      await flushPromises();
      expect((await read('ddb-authorization'))['ddb-authorization']).toBe('old-credential');
    } finally {
      release();
      await Promise.all([clearing, capture]);
    }
    expect(await getAuthToken()).toBe('new-credential');
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
  });

  it('clears a stored token', async () => {
    await setAuthToken('Bearer abc.def');
    await clearAuthToken();
    expect(await getAuthToken()).toBeNull();
  });
});
