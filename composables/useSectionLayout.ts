import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import type { Character, CharacterSection, SectionKey } from '@/services/dndbeyond/model';
import { defaultSectionOrder } from '@/utils/section-order';
import { sectionLayoutCount } from '@/utils/section-layout';
import {
  hiddenSectionsPref,
  sectionAnchorsPref,
  sectionLayoutPref,
} from '@/utils/preferences';

/**
 * Debounce (ms) before a placement is saved. A live drag calls `placeCard` many
 * times a second; `storage.sync` rate-limits writes, so we coalesce the save to
 * fire once the drag settles.
 */
const PLACEMENT_PERSIST_DELAY = 500;

/**
 * Reactive section layout for the sheet. Starts from the class-aware default
 * order and exposes `placeCard` to drag a card to any grid cell, `hide`/`show`
 * to move a section into (or out of) the not-printed tray, and `cycleLayout` to
 * change a card's density — all persisted to `storage.sync`.
 */
export function useSectionLayout(character: Ref<Character | null>) {
  const sections = ref<CharacterSection[]>([]);
  const hiddenKeys = ref<SectionKey[]>([]);
  const layoutIndices = ref<Record<string, number>>({});
  /** Card placements: section key → the cell (page, col, row-in-page) the user
   * moved it to, plus a `seq` recency stamp (higher = moved more recently). A
   * card with no entry sits at its default (class-aware) cell; every card carries
   * a recency so a freshly-dragged one is seated first and takes its cell. */
  const anchors = ref<Record<string, { page: number; col: number; row: number; seq: number }>>({});
  // Monotonic recency counter; the most recently moved card wins a contested cell.
  let nextSeq = 1;

  function rebuild() {
    sections.value = character.value ? defaultSectionOrder(character.value) : [];
  }

  onMounted(async () => {
    hiddenKeys.value = await hiddenSectionsPref.get([]);
    layoutIndices.value = await sectionLayoutPref.get({});
    anchors.value = await sectionAnchorsPref.get({});
    nextSeq = Object.values(anchors.value).reduce((max, p) => Math.max(max, p.seq ?? 0), 0) + 1;
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
  let pendingAnchors: Record<string, { page: number; col: number; row: number; seq: number }> | null = null;
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
    anchorTimer = setTimeout(flushAnchors, PLACEMENT_PERSIST_DELAY);
  }

  /** Move the card to a specific cell (page, col, row-in-page), stamping it as the
   * most recently moved so it's seated first and keeps that cell. The caller (the
   * drag) skips this when the card already renders at that cell, so the seq only
   * bumps on a real move. */
  function placeCard(key: SectionKey, cell: { page: number; col: number; row: number }) {
    anchors.value = {
      ...anchors.value,
      [key]: { page: cell.page, col: cell.col, row: cell.row, seq: nextSeq },
    };
    nextSeq += 1;
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
    // Drop any pending debounced save so it can't overwrite the reset.
    if (anchorTimer !== undefined) {
      clearTimeout(anchorTimer);
      anchorTimer = undefined;
    }
    pendingAnchors = null;
    hiddenKeys.value = [];
    layoutIndices.value = {};
    anchors.value = {};
    rebuild();
    void hiddenSectionsPref.set([]);
    void sectionLayoutPref.set({});
    void sectionAnchorsPref.set({});
  }

  // Persist any pending placement before the composable tears down.
  onBeforeUnmount(() => {
    flushAnchors();
  });

  return {
    sections: visibleSections,
    hiddenSections,
    layoutIndices,
    anchors,
    placeCard,
    cycleLayout,
    reset,
    hide: (key: SectionKey) => setHidden(key, true),
    show: (key: SectionKey) => setHidden(key, false),
  };
}
