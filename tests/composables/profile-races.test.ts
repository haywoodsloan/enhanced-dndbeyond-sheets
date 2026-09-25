import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { fakeBrowser } from 'wxt/testing';
import { useStoredRef } from '@/composables/useStoredRef';
import { useSectionLayout } from '@/composables/useSectionLayout';
import { useProfiles } from '@/composables/useProfiles';
import {
  PAGE_FORMAT_KEY,
  SECTION_ANCHORS_KEY,
  scopedKey,
  profilesPref,
} from '@/utils/settings/preferences';
import { mountComposable } from '../fixtures/mount-composable';
import { makeCharacter } from '../fixtures/character';
import { mockStorageLocks, settleStorageLocks } from '../utils/settings/storage-locks';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('profile persistence races', () => {
  const mounted: { unmount(): void }[] = [];

  beforeEach(() => {
    fakeBrowser.reset();
    mockStorageLocks();
  });
  afterEach(async () => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    await flushPromises();
    vi.restoreAllMocks();
  });

  it('ignores an old stored-ref load completing after the new profile', async () => {
    const first = deferred<Record<string, unknown>>();
    const firstKey = scopedKey(PAGE_FORMAT_KEY, 'first');
    const secondKey = scopedKey(PAGE_FORMAT_KEY, 'second');
    await fakeBrowser.storage.sync.set({ [secondKey]: 'legal' });
    const get = fakeBrowser.storage.sync.get.bind(fakeBrowser.storage.sync);
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockImplementation((key) =>
      key === firstKey ? first.promise : get(key),
    );
    const profile = ref('first');
    const { result, wrapper } = mountComposable(() => useStoredRef(PAGE_FORMAT_KEY, 'letter', profile));
    mounted.push(wrapper);
    profile.value = 'second';
    await flushPromises();
    expect(result.value).toBe('legal');

    first.resolve({ [firstKey]: 'a4' });
    await flushPromises();
    expect(result.value).toBe('legal');
    expect((await get(secondKey))[secondKey]).toBe('legal');
  });

  it('does not let an obsolete load enable writes while the new profile is loading', async () => {
    const first = deferred<Record<string, unknown>>();
    const second = deferred<Record<string, unknown>>();
    const firstKey = scopedKey(PAGE_FORMAT_KEY, 'first');
    const secondKey = scopedKey(PAGE_FORMAT_KEY, 'second');
    const get = fakeBrowser.storage.sync.get.bind(fakeBrowser.storage.sync);
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockImplementation((key) =>
      key === firstKey ? first.promise : key === secondKey ? second.promise : get(key),
    );
    const profile = ref('first');
    const { result, wrapper } = mountComposable(() => useStoredRef(PAGE_FORMAT_KEY, 'letter', profile));
    mounted.push(wrapper);
    profile.value = 'second';
    await flushPromises();
    first.resolve({ [firstKey]: 'a4' });
    await flushPromises();
    result.value = 'uninitialized edit';
    await flushPromises();
    expect((await get(secondKey))[secondKey]).toBeUndefined();
    second.resolve({ [secondKey]: 'legal' });
    await flushPromises();
    expect(result.value).toBe('legal');
  });

  it('does not write a stored ref to a newly selected profile before its watcher runs', async () => {
    const profile = ref('first');
    const { result, wrapper } = mountComposable(() => useStoredRef(PAGE_FORMAT_KEY, 'letter', profile));
    mounted.push(wrapper);
    await flushPromises();
    profile.value = 'second';
    result.value = 'a4';
    await flushPromises();
    const key = scopedKey(PAGE_FORMAT_KEY, 'second');
    expect((await fakeBrowser.storage.sync.get(key))[key]).toBeUndefined();
  });

  it('ignores an old layout load completing after the new profile', async () => {
    const first = deferred<Record<string, unknown>>();
    const firstKey = scopedKey(SECTION_ANCHORS_KEY, 'first');
    const secondKey = scopedKey(SECTION_ANCHORS_KEY, 'second');
    const secondAnchors = { basics: { page: 0, col: 2, row: 1, seq: 8 } };
    await fakeBrowser.storage.sync.set({ [secondKey]: secondAnchors });
    const get = fakeBrowser.storage.sync.get.bind(fakeBrowser.storage.sync);
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockImplementation((key) =>
      key === firstKey ? first.promise : get(key),
    );
    const profile = ref('first');
    const { result, wrapper } = mountComposable(() => useSectionLayout(ref(makeCharacter()), profile));
    mounted.push(wrapper);
    profile.value = 'second';
    await flushPromises();
    expect(result.anchors.value).toEqual(secondAnchors);
    first.resolve({ [firstKey]: { basics: { page: 9, col: 0, row: 0, seq: 1 } } });
    await flushPromises();
    expect(result.anchors.value).toEqual(secondAnchors);
    result.placeCard('notes', { page: 0, col: 0, row: 0 });
    wrapper.unmount();
    mounted.pop();
    await flushPromises();
    expect((await get(secondKey))[secondKey]).toMatchObject(secondAnchors);
    expect(result.anchors.value.notes.seq).toBe(9);
  });

  it('does not persist layout edits before the selected profile has loaded', async () => {
    const pending = deferred<Record<string, unknown>>();
    const key = scopedKey(SECTION_ANCHORS_KEY, 'second');
    const get = fakeBrowser.storage.sync.get.bind(fakeBrowser.storage.sync);
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockImplementation((requested) =>
      requested === key ? pending.promise : get(requested),
    );
    const profile = ref('first');
    const { result, wrapper } = mountComposable(() => useSectionLayout(ref(makeCharacter()), profile));
    mounted.push(wrapper);
    await flushPromises();
    profile.value = 'second';
    result.placeCard('basics', { page: 9, col: 0, row: 0 });
    result.hide('notes');
    result.setLayout('inventory', 1);
    await flushPromises();
    wrapper.unmount();
    mounted.pop();
    pending.resolve({ [key]: {} });
    await flushPromises();
    const stored = await get(null);
    expect(stored[key]).toBeUndefined();
    expect(stored['pref-hidden-sections::second']).toBeUndefined();
    expect(stored['pref-section-layout::second']).toBeUndefined();
  });

  it('synchronizes profile metadata between mounted sheets', async () => {
    const first = mountComposable(useProfiles);
    const second = mountComposable(useProfiles);
    mounted.push(first.wrapper, second.wrapper);
    await flushPromises();
    const id = first.result.create('Print');
    await flushPromises();
    expect(second.result.profiles.value).toEqual(first.result.profiles.value);
    second.result.rename(id, 'Renamed');
    await flushPromises();
    expect(first.result.profiles.value.find((profile) => profile.id === id)?.name).toBe('Renamed');
    first.result.remove(id);
    await flushPromises();
    expect(second.result.profiles.value).toEqual([{ id: 'default', name: 'Default' }]);
  });

  it('does not replace persisted metadata when a transactional read fails', async () => {
    const stored = {
      activeId: 'print',
      profiles: [
        { id: 'default', name: 'Default' },
        { id: 'print', name: 'Print' },
      ],
    };
    await profilesPref.set(stored);
    const { result, wrapper } = mountComposable(useProfiles);
    mounted.push(wrapper);
    await flushPromises();
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set');
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockRejectedValueOnce(new Error('read unavailable'));
    result.rename('default', 'Renamed');
    await settleStorageLocks();
    expect(await profilesPref.get({ activeId: '', profiles: [] })).toEqual(stored);
    expect(set).not.toHaveBeenCalled();
  });

  it('waits for another context’s debounced placement before copying the profile', async () => {
    const source = mountComposable(() => useSectionLayout(ref(makeCharacter())));
    mounted.push(source.wrapper);
    await flushPromises();
    vi.resetModules();
    const { copyProfileData } = await import('@/utils/settings/profiles');
    vi.useFakeTimers();
    try {
      source.result.placeCard('basics', { page: 2, col: 1, row: 4 });
      let copied = false;
      const copying = copyProfileData('default', 'copy').then(() => { copied = true; });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(499);
      expect(copied).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await copying;
      const copyKey = scopedKey(SECTION_ANCHORS_KEY, 'copy');
      expect((await fakeBrowser.storage.sync.get(copyKey))[copyKey]).toEqual({
        basics: { page: 2, col: 1, row: 4, seq: 1 },
      });
    } finally {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
    }
  });

  it('rebases stale create, rename, and delete operations on current metadata', async () => {
    vi.spyOn(fakeBrowser.storage.onChanged, 'addListener').mockImplementation(() => {});
    const first = mountComposable(useProfiles);
    const second = mountComposable(useProfiles);
    mounted.push(first.wrapper, second.wrapper);
    await flushPromises();
    const a = first.result.create('A');
    await flushPromises();
    const b = second.result.create('B');
    await flushPromises();
    first.result.rename(a, 'Renamed A');
    await flushPromises();
    second.result.remove('default');
    await flushPromises();
    const saved = await profilesPref.get({ activeId: '', profiles: [] });
    expect(saved.profiles).toEqual([{ id: a, name: 'Renamed A' }, { id: b, name: 'B' }]);
  });

  it('preserves simultaneous creates from two mounted sheets', async () => {
    const first = mountComposable(useProfiles);
    const second = mountComposable(useProfiles);
    mounted.push(first.wrapper, second.wrapper);
    await flushPromises();
    const a = first.result.create('A');
    const b = second.result.create('B');
    await flushPromises();
    const saved = await profilesPref.get({ activeId: '', profiles: [] });
    expect(saved.profiles.map((profile) => profile.id)).toEqual(['default', a, b]);
  });

  it('duplicates a placement immediately without waiting for its debounce', async () => {
    const sheet = mountComposable(() => {
      const profiles = useProfiles();
      const layout = useSectionLayout(ref(makeCharacter()), profiles.activeId);
      return { profiles, layout };
    });
    mounted.push(sheet.wrapper);
    await flushPromises();
    sheet.result.layout.placeCard('basics', { page: 2, col: 1, row: 4 });
    await sheet.result.profiles.duplicate('default');
    await flushPromises();
    const copyKey = scopedKey(SECTION_ANCHORS_KEY, sheet.result.profiles.activeId.value);
    expect((await fakeBrowser.storage.sync.get(copyKey))[copyKey]).toEqual({
      basics: { page: 2, col: 1, row: 4, seq: 1 },
    });
    expect(sheet.result.layout.anchors.value.basics).toMatchObject({ page: 2, row: 4 });
  });

  it('discards malformed anchors with a settings diagnostic and completes initialization', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await fakeBrowser.storage.sync.set({
      [SECTION_ANCHORS_KEY]: {
        basics: null,
        notes: { page: -1, col: 0, row: 0, seq: 9 },
        portrait: { page: 0, col: 1, row: 2, seq: 4 },
      },
    });
    const { result, wrapper } = mountComposable(() => useSectionLayout(ref(makeCharacter())));
    mounted.push(wrapper);
    await flushPromises();
    expect(result.anchors.value).toEqual({ portrait: { page: 0, col: 1, row: 2, seq: 4 } });
    result.placeCard('basics', { page: 0, col: 0, row: 0 });
    expect(result.anchors.value.basics.seq).toBe(5);
    expect(log.mock.calls.some(([message]) => /settings.*invalid.*anchor/i.test(String(message)))).toBe(true);
  });

  it('discards malformed profile entries with a diagnostic and loads valid metadata', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await fakeBrowser.storage.sync.set({
      'pref-profiles': { activeId: 'ok', profiles: [null, { id: 2, name: 'Bad' }, { id: 'ok', name: 'Valid' }] },
    });
    const { result, wrapper } = mountComposable(useProfiles);
    mounted.push(wrapper);
    await flushPromises();
    expect(result.profiles.value).toEqual([{ id: 'ok', name: 'Valid' }]);
    expect(result.activeId.value).toBe('ok');
    expect(log.mock.calls.some(([message]) => /settings.*invalid.*profile/i.test(String(message)))).toBe(true);
  });
});
