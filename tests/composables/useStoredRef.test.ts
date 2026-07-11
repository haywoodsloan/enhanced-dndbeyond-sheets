import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useStoredRef } from '@/composables/useStoredRef';
import type { Preference } from '@/utils/preferences';
import { mountComposable } from '../fixtures/mount-composable';

/** An in-memory {@link Preference} that records every `set` call. */
function fakePreference<T>(initial?: T) {
  let stored = initial;
  const sets: T[] = [];
  const preference: Preference<T> = {
    get: async (fallback: T) => (stored === undefined ? fallback : stored),
    set: async (value: T) => {
      stored = value;
      sets.push(value);
    },
  };
  return { preference, sets };
}

describe('useStoredRef', () => {
  it('holds the fallback until the stored value loads', async () => {
    const { preference } = fakePreference('a4');
    const { result } = mountComposable(() => useStoredRef(preference, 'letter'));

    expect(result.value).toBe('letter');
    await flushPromises();
    expect(result.value).toBe('a4');
  });

  it('does not re-persist the value it just loaded', async () => {
    const { preference, sets } = fakePreference('a4');
    mountComposable(() => useStoredRef(preference, 'letter'));

    await flushPromises();
    expect(sets).toEqual([]);
  });

  it('writes back to the preference when the ref changes', async () => {
    const { preference, sets } = fakePreference<string>();
    const { result } = mountComposable(() => useStoredRef(preference, 'letter'));
    await flushPromises();

    result.value = 'a4';
    await flushPromises();
    expect(sets).toEqual(['a4']);
    expect(result.value).toBe('a4');
  });
});
