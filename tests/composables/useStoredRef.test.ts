import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { fakeBrowser } from 'wxt/testing';
import { useStoredRef } from '@/composables/useStoredRef';
import { DEFAULT_PROFILE_ID, scopedKey } from '@/utils/settings/preferences';
import { mountComposable } from '../fixtures/mount-composable';

const KEY = 'pref-page-format';

describe('useStoredRef', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('holds the fallback until the stored value loads', async () => {
    await fakeBrowser.storage.sync.set({ [KEY]: 'a4' });
    const { result } = mountComposable(() => useStoredRef(KEY, 'letter'));

    expect(result.value).toBe('letter');
    await flushPromises();
    expect(result.value).toBe('a4');
  });

  it('does not re-persist the value it just loaded', async () => {
    await fakeBrowser.storage.sync.set({ [KEY]: 'a4' });
    const setSpy = vi.spyOn(fakeBrowser.storage.sync, 'set');
    mountComposable(() => useStoredRef(KEY, 'letter'));

    await flushPromises();
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });

  it('writes back to storage when the ref changes', async () => {
    const { result } = mountComposable(() => useStoredRef(KEY, 'letter'));
    await flushPromises();

    result.value = 'a4';
    await flushPromises();
    expect((await fakeBrowser.storage.sync.get(KEY))[KEY]).toBe('a4');
  });

  it('scopes storage per profile and reloads when the active profile changes', async () => {
    const profileId = ref(DEFAULT_PROFILE_ID);
    const { result } = mountComposable(() => useStoredRef(KEY, 'letter', profileId));
    await flushPromises();

    // The default profile uses the bare key.
    result.value = 'a4';
    await flushPromises();
    expect((await fakeBrowser.storage.sync.get(KEY))[KEY]).toBe('a4');

    // Switching profiles reloads (nothing saved yet → fallback) and writes to a
    // scoped key, leaving the default profile's value untouched.
    profileId.value = 'p2';
    await flushPromises();
    expect(result.value).toBe('letter');

    result.value = 'legal';
    await flushPromises();
    const p2Key = scopedKey(KEY, 'p2');
    expect((await fakeBrowser.storage.sync.get(p2Key))[p2Key]).toBe('legal');
    expect((await fakeBrowser.storage.sync.get(KEY))[KEY]).toBe('a4');
  });
});
