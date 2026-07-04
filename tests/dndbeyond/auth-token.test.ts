import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import {
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
  });

  it('stores and reads the authorization header value', async () => {
    await setAuthToken('Bearer abc.def');
    expect(await getAuthToken()).toBe('Bearer abc.def');
  });

  it('returns null when no token is stored', async () => {
    expect(await getAuthToken()).toBeNull();
  });
});
