import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { fakeBrowser } from 'wxt/testing';
import { useProfiles } from '@/composables/useProfiles';
import { SECTION_ANCHORS_KEY, profilesPref, scopedKey } from '@/utils/settings/preferences';
import { mountComposable } from '../fixtures/mount-composable';

describe('useProfiles', () => {
  beforeEach(() => {
    fakeBrowser.reset();
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
    await fakeBrowser.storage.sync.set({
      [sourceKey]: { basics: { page: 0, col: 1, row: 2, seq: 3 } },
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

    // Duplicating an unknown id is a no-op.
    await result.duplicate('nope');
    expect(result.profiles.value).toHaveLength(2);
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
    const saved = await profilesPref.get({ activeId: 'default', profiles: [] });
    expect(saved.profiles.find((profile) => profile.id === id)?.name).toBe('Tablet');
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
});
