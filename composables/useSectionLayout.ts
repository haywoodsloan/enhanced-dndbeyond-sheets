import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
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
 * Debounce (ms) before a reorder is saved. A live drag calls `moveByIndex` many
 * times a second; `storage.sync` rate-limits writes, so we coalesce the save to
 * fire once the reorder settles.
 */
const ORDER_PERSIST_DELAY = 500;

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

  // A live drag calls `moveByIndex` many times a second; persisting on each one
  // would blow `storage.sync`'s write-rate limit, so the save is debounced to
  // fire once the reorder settles (and flushed on unmount).
  let orderTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingOrder: SectionKey[] | null = null;
  function flushOrder() {
    if (orderTimer !== undefined) {
      clearTimeout(orderTimer);
      orderTimer = undefined;
    }
    if (pendingOrder) {
      void sectionOrderPref.set(pendingOrder);
      pendingOrder = null;
    }
  }

  /** Move the visible card at `from` to `to`, then persist the new order. */
  function moveByIndex(from: number, to: number) {
    const next = moveVisibleByIndex(sections.value, hiddenKeys.value, from, to);
    if (next === sections.value) return;
    sections.value = next;
    const keys = next.map((section) => section.key);
    savedOrder.value = keys;
    pendingOrder = keys;
    if (orderTimer !== undefined) clearTimeout(orderTimer);
    orderTimer = setTimeout(flushOrder, ORDER_PERSIST_DELAY);
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

  /** Restore the default layout — default order, nothing hidden, default card
   * layouts — and clear the saved preferences. */
  function reset() {
    // Drop any pending debounced order save so it can't overwrite the reset.
    if (orderTimer !== undefined) {
      clearTimeout(orderTimer);
      orderTimer = undefined;
    }
    pendingOrder = null;
    savedOrder.value = [];
    hiddenKeys.value = [];
    layoutIndices.value = {};
    rebuild();
    void sectionOrderPref.set([]);
    void hiddenSectionsPref.set([]);
    void sectionLayoutPref.set({});
  }

  // Persist any pending reorder before the composable tears down.
  onBeforeUnmount(flushOrder);

  return {
    sections: visibleSections,
    hiddenSections,
    layoutIndices,
    moveByIndex,
    cycleLayout,
    reset,
    hide: (key: SectionKey) => setHidden(key, true),
    show: (key: SectionKey) => setHidden(key, false),
  };
}
