import { computed, onMounted, ref, watch, type Ref } from 'vue';
import type { Character, CharacterSection, SectionKey } from '@/services/dndbeyond/model';
import {
  applySavedOrder,
  defaultSectionOrder,
  moveVisibleByIndex,
} from '@/utils/section-order';
import { sectionLayoutCount } from '@/utils/section-layout';
import {
  hiddenSectionsPref,
  sectionLayoutPref,
  sectionOrderPref,
} from '@/utils/preferences';

/**
 * Reactive section layout for the sheet. Starts from the class-aware default
 * order, applies the user's saved order (loaded from local storage), and
 * exposes `moveByIndex` to drag-reorder the visible cards plus `hide`/`show`
 * to move a section into (or out of) the not-printed tray — both persisted.
 */
export function useSectionLayout(character: Ref<Character | null>) {
  const sections = ref<CharacterSection[]>([]);
  const savedOrder = ref<SectionKey[]>([]);
  const hiddenKeys = ref<SectionKey[]>([]);
  const layoutIndices = ref<Record<string, number>>({});

  function rebuild() {
    sections.value = character.value
      ? applySavedOrder(defaultSectionOrder(character.value), savedOrder.value)
      : [];
  }

  onMounted(async () => {
    savedOrder.value = await sectionOrderPref.get([]);
    hiddenKeys.value = await hiddenSectionsPref.get([]);
    layoutIndices.value = await sectionLayoutPref.get({});
    rebuild();
  });
  watch(character, rebuild);

  const hiddenSet = computed(() => new Set(hiddenKeys.value));
  /** Sections shown on the printable pages (drag order, minus hidden). */
  const visibleSections = computed(() =>
    sections.value.filter((section) => !hiddenSet.value.has(section.key)),
  );
  /** Hidden sections, shown off-page in the not-printed tray. */
  const hiddenSections = computed(() =>
    sections.value.filter((section) => hiddenSet.value.has(section.key)),
  );

  /** Move the visible card at `from` to `to`, then persist the new order. */
  function moveByIndex(from: number, to: number) {
    const next = moveVisibleByIndex(sections.value, hiddenKeys.value, from, to);
    if (next === sections.value) return;
    sections.value = next;
    const keys = next.map((section) => section.key);
    savedOrder.value = keys;
    void sectionOrderPref.set(keys);
  }

  function setHidden(key: SectionKey, hidden: boolean) {
    if (hiddenKeys.value.includes(key) === hidden) return;
    hiddenKeys.value = hidden
      ? [...hiddenKeys.value, key]
      : hiddenKeys.value.filter((candidate) => candidate !== key);
    void hiddenSectionsPref.set(hiddenKeys.value);
  }

  /** Advance a section to its next curated layout option, then persist it. */
  function cycleLayout(key: SectionKey) {
    const count = sectionLayoutCount(key);
    if (count <= 1) return;
    const next = ((layoutIndices.value[key] ?? 0) + 1) % count;
    layoutIndices.value = { ...layoutIndices.value, [key]: next };
    void sectionLayoutPref.set(layoutIndices.value);
  }

  return {
    sections: visibleSections,
    hiddenSections,
    layoutIndices,
    moveByIndex,
    cycleLayout,
    hide: (key: SectionKey) => setHidden(key, true),
    show: (key: SectionKey) => setHidden(key, false),
  };
}
