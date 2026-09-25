import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { fakeBrowser } from 'wxt/testing';
import { useProfiles } from '@/composables/useProfiles';
import {
  AUTO_SHOWN_SECTIONS_KEY,
  SECTION_ANCHORS_KEY,
  profilesPref,
  scopedKey,
  registerProfileFlush,
} from '@/utils/settings/preferences';
import { mountComposable } from '../fixtures/mount-composable';
import { mockStorageLocks, settleStorageLocks } from '../utils/settings/storage-locks';

describe('useProfiles', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    mockStorageLocks();
  });

  afterEach(async () => {
    await settleStorageLocks();
    vi.restoreAllMocks();
  });

  it('starts with a single Default profile', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();
    expect(result.profiles.value).toEqual([{ id: 'default', name: 'Default' }]);
    expect(result.activeId.value).toBe('default');
  });

  it('creates a profile, switches to it, and persists', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();

    result.create('Print');
    await flushPromises();
    expect(result.profiles.value).toHaveLength(2);
    const created = result.profiles.value[1];
    expect(created.name).toBe('Print');
    expect(result.activeId.value).toBe(created.id);

    const saved = await profilesPref.get({ activeId: 'default', profiles: [] });
    expect(saved.activeId).toBe(created.id);
    expect(saved.profiles).toHaveLength(2);
  });

  it('switches between profiles and ignores unknown ids', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();
    result.create();
    await flushPromises();
    const other = result.activeId.value;

    result.switchTo('default');
    expect(result.activeId.value).toBe('default');

    result.switchTo(other);
    expect(result.activeId.value).toBe(other);

    result.switchTo('nope');
    expect(result.activeId.value).toBe(other);
  });

  it('deletes a profile (never the last), reactivating and cleaning up its data', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();
    result.create('Temp');
    await flushPromises();
    const temp = result.activeId.value;

    // Give the temp profile some scoped settings that deletion should remove.
    const anchorsKey = scopedKey(SECTION_ANCHORS_KEY, temp);
    await fakeBrowser.storage.sync.set({
      [anchorsKey]: { basics: { page: 0, col: 0, row: 0, seq: 1 } },
    });

    result.remove(temp);
    await flushPromises();
    expect(result.profiles.value).toEqual([{ id: 'default', name: 'Default' }]);
    expect(result.activeId.value).toBe('default'); // reactivated the remaining one
    expect((await fakeBrowser.storage.sync.get(anchorsKey))[anchorsKey]).toBeUndefined();

    // The last remaining profile can't be deleted.
    result.remove('default');
    expect(result.profiles.value).toHaveLength(1);
  });

  it('duplicates a profile, copying its settings into a new active one', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();

    // Give the Default profile some settings to copy.
    const sourceKey = scopedKey(SECTION_ANCHORS_KEY, 'default');
    const sourceAutoShownKey = scopedKey(AUTO_SHOWN_SECTIONS_KEY, 'default');
    await fakeBrowser.storage.sync.set({
      [sourceKey]: { basics: { page: 0, col: 1, row: 2, seq: 3 } },
      [sourceAutoShownKey]: ['portrait'],
    });

    await result.duplicate('default');
    await flushPromises();

    expect(result.profiles.value).toHaveLength(2);
    const copy = result.profiles.value[1];
    expect(copy.name).toBe('Default copy');
    expect(result.activeId.value).toBe(copy.id);

    // The copy's scoped settings mirror the source profile's.
    const copyKey = scopedKey(SECTION_ANCHORS_KEY, copy.id);
    expect((await fakeBrowser.storage.sync.get(copyKey))[copyKey]).toEqual({
      basics: { page: 0, col: 1, row: 2, seq: 3 },
    });
    const copyAutoShownKey = scopedKey(AUTO_SHOWN_SECTIONS_KEY, copy.id);
    expect((await fakeBrowser.storage.sync.get(copyAutoShownKey))[copyAutoShownKey]).toEqual([
      'portrait',
    ]);

    // Duplicating an unknown id is a no-op.
    await result.duplicate('nope');
    expect(result.profiles.value).toHaveLength(2);
  });

  it('abandons duplication after a bounded wait for a stalled source flush', async () => {
    const { result, wrapper } = mountComposable(useProfiles);
    await flushPromises();
    let release!: () => void;
    const stalled = new Promise<void>((resolve) => { release = resolve; });
    const unregister = registerProfileFlush(() => stalled);
    vi.useFakeTimers();
    try {
      const copying = result.duplicate('default');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(5_000);
      await copying;
      expect(result.profiles.value).toEqual([{ id: 'default', name: 'Default' }]);
      release();
      await flushPromises();
      expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
    } finally {
      release();
      unregister();
      vi.useRealTimers();
      wrapper.unmount();
    }
  });

  it('renames a profile, trimming and ignoring blank names', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();
    result.create('Screen');
    await flushPromises();
    const id = result.activeId.value;

    result.rename(id, '  Tablet  ');
    expect(result.profiles.value.find((profile) => profile.id === id)?.name).toBe('Tablet');

    // Blank names are ignored (keeps the previous name).
    result.rename(id, '   ');
    expect(result.profiles.value.find((profile) => profile.id === id)?.name).toBe('Tablet');

    // The rename is persisted.
    await settleStorageLocks();
    const saved = await profilesPref.get({ activeId: 'default', profiles: [] });
    expect(saved.profiles.find((profile) => profile.id === id)?.name).toBe('Tablet');
  });

  it('gives each duplicate a unique, incrementing copy name', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();

    await result.duplicate('default');
    await flushPromises();
    await result.duplicate('default');
    await flushPromises();
    expect(result.profiles.value.map((profile) => profile.name)).toEqual([
      'Default',
      'Default copy',
      'Default copy 2',
    ]);

    // Duplicating a copy re-bases the name (no "copy copy").
    const copyId = result.profiles.value[1].id;
    await result.duplicate(copyId);
    await flushPromises();
    expect(result.profiles.value.at(-1)?.name).toBe('Default copy 3');
  });

  it('create returns the new profile id', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();
    const id = result.create('Screen');
    expect(typeof id).toBe('string');
    expect(result.profiles.value.find((profile) => profile.id === id)?.name).toBe('Screen');
    expect(result.activeId.value).toBe(id);
  });

  it('moves a profile to a target index, clamping out-of-range', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();
    result.create('B');
    await flushPromises();
    result.create('C');
    await flushPromises();
    expect(result.profiles.value.map((profile) => profile.name)).toEqual(['Default', 'B', 'C']);

    const cId = result.profiles.value[2].id;
    result.moveTo(cId, 0); // C to the front
    expect(result.profiles.value.map((profile) => profile.name)).toEqual(['C', 'Default', 'B']);
    result.moveTo(cId, 1); // C to the middle
    expect(result.profiles.value.map((profile) => profile.name)).toEqual(['Default', 'C', 'B']);
    result.moveTo(cId, 99); // clamps to the last slot
    expect(result.profiles.value.map((profile) => profile.name)).toEqual(['Default', 'B', 'C']);
    result.moveTo('nope', 0); // unknown id → no-op
    expect(result.profiles.value.map((profile) => profile.name)).toEqual(['Default', 'B', 'C']);
  });

  it('loads a persisted profile list and active id', async () => {
    await profilesPref.set({
      activeId: 'p2',
      profiles: [
        { id: 'default', name: 'Default' },
        { id: 'p2', name: 'Screen' },
      ],
    });
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();
    expect(result.profiles.value).toHaveLength(2);
    expect(result.activeId.value).toBe('p2');
  });

  it('falls back from an invalid stored active id', async () => {
    await profilesPref.set({
      activeId: 'missing',
      profiles: [
        { id: 'default', name: 'Default' },
        { id: 'p2', name: 'Screen' },
      ],
    });
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();

    expect(result.activeId.value).toBe('default');
    result.activeId.value = 'missing';
    expect(result.activeProfile.value.name).toBe('Default');
  });

  it('ignores no-op profile operations', async () => {
    const { result } = mountComposable(() => useProfiles());
    await flushPromises();

    result.rename('missing', 'Name');
    result.rename('default', 'Default');
    result.moveTo('default', 0);
    result.switchTo('default');
    expect(result.profiles.value).toEqual([{ id: 'default', name: 'Default' }]);

    result.create('Second');
    await flushPromises();
    result.remove('default');
    await flushPromises();
    expect(result.profiles.value.map((profile) => profile.name)).toEqual(['Second']);
  });

  it('persists user changes made before initial storage has loaded', async () => {
    const { result } = mountComposable(() => useProfiles());
    const id = result.create('Early');
    await settleStorageLocks();

    const saved = await profilesPref.get({ activeId: 'default', profiles: [] });
    expect(saved.profiles).toContainEqual({ id, name: 'Early' });
  });

  it('replays an early create and rename after a deferred metadata read without losing saved profiles', async () => {
    const stored = {
      activeId: 'existing',
      profiles: [
        { id: 'default', name: 'Default' },
        { id: 'existing', name: 'Saved layout' },
      ],
    };
    await profilesPref.set(stored);
    let release!: (state: typeof stored) => void;
    vi.spyOn(profilesPref, 'get').mockImplementationOnce(() =>
      new Promise((resolve) => { release = resolve; }),
    );
    const { result, wrapper } = mountComposable(() => useProfiles());
    try {
      const id = result.create('Early');
      result.rename(id, 'Early renamed');
      expect(result.profiles.value).toContainEqual({ id, name: 'Early renamed' });
      await flushPromises();
      expect(await profilesPref.get({ activeId: '', profiles: [] })).toEqual(stored);

      release(stored);
      await settleStorageLocks();
      const saved = await profilesPref.get({ activeId: '', profiles: [] });
      expect(saved).toEqual({
        activeId: id,
        profiles: [...stored.profiles, { id, name: 'Early renamed' }],
      });
      expect(result.profiles.value).toEqual(saved.profiles);
    } finally {
      release(stored);
      wrapper.unmount();
    }
  });

  it('preserves an early rename of the default profile when persisted metadata finishes loading', async () => {
    const stored = {
      activeId: 'existing',
      profiles: [
        { id: 'default', name: 'Old name' },
        { id: 'existing', name: 'Saved layout' },
      ],
    };
    await profilesPref.set(stored);
    let release!: (state: typeof stored) => void;
    vi.spyOn(profilesPref, 'get').mockImplementationOnce(() =>
      new Promise((resolve) => { release = resolve; }),
    );
    const { result, wrapper } = mountComposable(() => useProfiles());
    try {
      result.rename('default', 'Early rename');
      release(stored);
      await settleStorageLocks();
      const saved = await profilesPref.get({ activeId: '', profiles: [] });
      expect(saved).toEqual({
        activeId: 'existing',
        profiles: [
          { id: 'default', name: 'Early rename' },
          { id: 'existing', name: 'Saved layout' },
        ],
      });
      expect(result.profiles.value).toEqual(saved.profiles);
    } finally {
      release(stored);
      wrapper.unmount();
    }
  });
});
