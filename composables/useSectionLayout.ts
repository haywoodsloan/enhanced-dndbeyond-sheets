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
  sectionAnchorsPref,
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
  /** Manual placements: section key → pinned cell (page, col, row-in-page). */
  const anchors = ref<Record<string, { page: number; col: number; row: number }>>({});

  function rebuild() {
    sections.value = character.value
      ? applySavedOrder(defaultSectionOrder(character.value), savedOrder.value)
      : [];
  }

  onMounted(async () => {
    savedOrder.value = await sectionOrderPref.get([]);
    hiddenKeys.value = await hiddenSectionsPref.get([]);
    layoutIndices.value = await sectionLayoutPref.get({});
    anchors.value = await sectionAnchorsPref.get({});
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
    // A hidden card shouldn't keep a stale placement; it re-joins the flow when
    // shown again.
    if (hidden) clearAnchor(key);
  }

  /** Advance a section to its next curated layout option, then persist it. */
  function cycleLayout(key: SectionKey) {
    const count = sectionLayoutCount(key);
    if (count <= 1) return;
    const next = ((layoutIndices.value[key] ?? 0) + 1) % count;
    layoutIndices.value = { ...layoutIndices.value, [key]: next };
    void sectionLayoutPref.set(layoutIndices.value);
  }

  // Manual placements are set live during a drag (like reorder), so their save
  // is debounced too, to respect the storage.sync write-rate limit.
  let anchorTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingAnchors: Record<string, { page: number; col: number; row: number }> | null = null;
  function flushAnchors() {
    if (anchorTimer !== undefined) {
      clearTimeout(anchorTimer);
      anchorTimer = undefined;
    }
    if (pendingAnchors) {
      void sectionAnchorsPref.set(pendingAnchors);
      pendingAnchors = null;
    }
  }
  function persistAnchors() {
    pendingAnchors = anchors.value;
    if (anchorTimer !== undefined) clearTimeout(anchorTimer);
    anchorTimer = setTimeout(flushAnchors, ORDER_PERSIST_DELAY);
  }

  /** Pin the visible card to a specific cell (page, col, row-in-page). */
  function placeCard(key: SectionKey, cell: { page: number; col: number; row: number }) {
    const current = anchors.value[key];
    if (
      current &&
      current.page === cell.page &&
      current.col === cell.col &&
      current.row === cell.row
    ) {
      return;
    }
    anchors.value = { ...anchors.value, [key]: { page: cell.page, col: cell.col, row: cell.row } };
    persistAnchors();
  }

  /** Drop a card's manual placement so it rejoins the normal flow. */
  function clearAnchor(key: SectionKey) {
    if (!(key in anchors.value)) return;
    const next = { ...anchors.value };
    delete next[key];
    anchors.value = next;
    persistAnchors();
  }

  /** Restore the default layout — default order, nothing hidden, default card
   * layouts — and clear the saved preferences. */
  function reset() {
    // Drop any pending debounced saves so they can't overwrite the reset.
    if (orderTimer !== undefined) {
      clearTimeout(orderTimer);
      orderTimer = undefined;
    }
    pendingOrder = null;
    if (anchorTimer !== undefined) {
      clearTimeout(anchorTimer);
      anchorTimer = undefined;
    }
    pendingAnchors = null;
    savedOrder.value = [];
    hiddenKeys.value = [];
    layoutIndices.value = {};
    anchors.value = {};
    rebuild();
    void sectionOrderPref.set([]);
    void hiddenSectionsPref.set([]);
    void sectionLayoutPref.set({});
    void sectionAnchorsPref.set({});
  }

  // Persist any pending reorder / placement before the composable tears down.
  onBeforeUnmount(() => {
    flushOrder();
    flushAnchors();
  });

  return {
    sections: visibleSections,
    hiddenSections,
    layoutIndices,
    anchors,
    moveByIndex,
    placeCard,
    clearAnchor,
    cycleLayout,
    reset,
    hide: (key: SectionKey) => setHidden(key, true),
    show: (key: SectionKey) => setHidden(key, false),
  };
}
