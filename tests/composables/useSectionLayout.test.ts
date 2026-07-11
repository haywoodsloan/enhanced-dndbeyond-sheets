import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { fakeBrowser } from 'wxt/testing';
import { useSectionLayout } from '@/composables/useSectionLayout';
import {
  hiddenSectionsPref,
  sectionAnchorsPref,
  sectionLayoutPref,
} from '@/utils/settings/preferences';
import { SECTION_KEYS, type Character } from '@/services/dndbeyond/model';
import { makeCharacter } from '../fixtures/character';
import { mountComposable } from '../fixtures/mount-composable';

/** A Fighter (martial layout) with every section present and non-empty. */
function fighter(): Character {
  return makeCharacter({
    classes: [{ name: 'Fighter', level: 5 }],
    level: 5,
    sections: SECTION_KEYS.map((key) => ({ key, title: key, count: 1, isEmpty: false })),
  });
}

const keys = (sections: { key: string }[]) => sections.map((section) => section.key);

describe('useSectionLayout', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('is empty until a character loads, then builds the default order', async () => {
    const character = ref<Character | null>(null);
    const { result } = mountComposable(() => useSectionLayout(character));
    await flushPromises();
    expect(result.sections.value).toEqual([]);

    character.value = fighter();
    await flushPromises();
    // Martial default leads with basics/attributes/portrait.
    expect(keys(result.sections.value).slice(0, 3)).toEqual(['basics', 'attributes', 'portrait']);
  });

  it('hides a section into the tray and shows it again, persisting each change', async () => {
    const character = ref<Character | null>(fighter());
    const { result } = mountComposable(() => useSectionLayout(character));
    await flushPromises();

    result.hide('notes');
    await flushPromises();
    expect(keys(result.sections.value)).not.toContain('notes');
    expect(keys(result.hiddenSections.value)).toContain('notes');
    expect(await hiddenSectionsPref.get([])).toContain('notes');

    result.show('notes');
    await flushPromises();
    expect(keys(result.hiddenSections.value)).not.toContain('notes');
    expect(await hiddenSectionsPref.get(['notes'])).toEqual([]);
  });

  it('cycles a card layout and persists it, but ignores sections with one option', async () => {
    const character = ref<Character | null>(fighter());
    const { result } = mountComposable(() => useSectionLayout(character));
    await flushPromises();

    result.cycleLayout('inventory'); // inventory has 3 options
    await flushPromises();
    expect(result.layoutIndices.value.inventory).toBe(1);
    expect(await sectionLayoutPref.get({})).toEqual({ inventory: 1 });

    // 'basics' has a single fixed footprint — cycling is a no-op.
    result.cycleLayout('basics');
    await flushPromises();
    expect(result.layoutIndices.value.basics).toBeUndefined();
  });

  it('places a card with an incrementing recency stamp', async () => {
    const character = ref<Character | null>(fighter());
    const { result } = mountComposable(() => useSectionLayout(character));
    await flushPromises();

    result.placeCard('portrait', { page: 0, col: 2, row: 1 });
    result.placeCard('skills', { page: 0, col: 0, row: 0 });
    expect(result.anchors.value.portrait).toEqual({ page: 0, col: 2, row: 1, seq: 1 });
    expect(result.anchors.value.skills.seq).toBe(2);
  });

  it('compacts by replacing all anchors with the given gap-free cells', async () => {
    const character = ref<Character | null>(fighter());
    const { result } = mountComposable(() => useSectionLayout(character));
    await flushPromises();

    // A stray manual placement that compacting should sweep away.
    result.placeCard('notes', { page: 3, col: 0, row: 0 });
    result.compact({
      basics: { page: 0, col: 0, row: 0 },
      attributes: { page: 0, col: 1, row: 0 },
    });

    // Only the compacted cells remain, each pinned to its new cell.
    expect(Object.keys(result.anchors.value)).toEqual(['basics', 'attributes']);
    expect(result.anchors.value.basics).toMatchObject({ page: 0, col: 0, row: 0 });
    expect(result.anchors.value.attributes).toMatchObject({ page: 0, col: 1, row: 0 });
    // The compacted cards share one recency stamp.
    expect(result.anchors.value.basics.seq).toBe(result.anchors.value.attributes.seq);
  });

  it('debounces the placement save and flushes it after the delay', async () => {
    vi.useFakeTimers();
    try {
      const character = ref<Character | null>(fighter());
      const { result } = mountComposable(() => useSectionLayout(character));
      await vi.runOnlyPendingTimersAsync();

      result.placeCard('portrait', { page: 0, col: 1, row: 1 });
      expect(await sectionAnchorsPref.get({})).toEqual({}); // not yet written

      await vi.advanceTimersByTimeAsync(500);
      expect((await sectionAnchorsPref.get({})).portrait).toMatchObject({ col: 1, row: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes a pending placement on unmount', async () => {
    const character = ref<Character | null>(fighter());
    const { result, wrapper } = mountComposable(() => useSectionLayout(character));
    await flushPromises();

    result.placeCard('portrait', { page: 0, col: 1, row: 0 });
    wrapper.unmount();
    await flushPromises();
    expect((await sectionAnchorsPref.get({})).portrait).toBeDefined();
  });

  it('clears a placed card’s anchor when it is hidden', async () => {
    const character = ref<Character | null>(fighter());
    const { result } = mountComposable(() => useSectionLayout(character));
    await flushPromises();

    result.placeCard('inventory', { page: 0, col: 0, row: 0 });
    expect(result.anchors.value.inventory).toBeDefined();
    result.hide('inventory');
    await flushPromises();
    expect(result.anchors.value.inventory).toBeUndefined();
  });

  it('loads saved preferences and seeds the next recency above the saved max', async () => {
    await sectionAnchorsPref.set({ portrait: { page: 0, col: 1, row: 1, seq: 7 } });
    await hiddenSectionsPref.set(['notes']);
    await sectionLayoutPref.set({ inventory: 2 });

    const character = ref<Character | null>(fighter());
    const { result } = mountComposable(() => useSectionLayout(character));
    await flushPromises();

    expect(result.anchors.value.portrait.seq).toBe(7);
    expect(keys(result.hiddenSections.value)).toContain('notes');
    expect(result.layoutIndices.value).toEqual({ inventory: 2 });

    result.placeCard('skills', { page: 0, col: 0, row: 0 });
    expect(result.anchors.value.skills.seq).toBe(8);
  });

  it('reset restores the defaults and clears the saved preferences', async () => {
    const character = ref<Character | null>(fighter());
    const { result } = mountComposable(() => useSectionLayout(character));
    await flushPromises();

    result.placeCard('portrait', { page: 0, col: 2, row: 1 });
    result.hide('notes');
    result.cycleLayout('inventory');
    await flushPromises();

    result.reset();
    await flushPromises();
    expect(result.anchors.value).toEqual({});
    expect(result.hiddenSections.value).toEqual([]);
    expect(result.layoutIndices.value).toEqual({});
    expect(await sectionAnchorsPref.get({})).toEqual({});
    expect(await hiddenSectionsPref.get(['notes'])).toEqual([]);
    expect(await sectionLayoutPref.get({ a: 1 })).toEqual({});
  });
});
