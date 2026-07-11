import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import type { Character, CharacterSection, SectionKey } from '@/services/dndbeyond/model';
import { defaultSectionOrder } from '@/utils/layout/section-order';
import { sectionLayoutCount } from '@/utils/layout/section-layout';
import {
  DEFAULT_PROFILE_ID,
  HIDDEN_SECTIONS_KEY,
  SECTION_ANCHORS_KEY,
  SECTION_LAYOUT_KEY,
  scopedPreference,
} from '@/utils/settings/preferences';

/**
 * Debounce (ms) before a placement is saved. A live drag calls `placeCard` many
 * times a second; `storage.sync` rate-limits writes, so we coalesce the save to
 * fire once the drag settles.
 */
const PLACEMENT_PERSIST_DELAY = 500;

/**
 * Reactive section layout for the sheet. Starts from the class-aware default
 * order and exposes `placeCard` to drag a card to any grid cell, `hide`/`show`
 * to move a section into (or out of) the not-printed tray, and `setLayout` to
 * change a card's density — all persisted to `storage.sync`.
 */
export function useSectionLayout(
  character: Ref<Character | null>,
  profileId: Ref<string> = ref(DEFAULT_PROFILE_ID),
) {
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

  // The active profile's scoped settings (the default profile uses the original,
  // unscoped keys). Recomputed per call so a profile switch takes effect.
  const hiddenPref = () => scopedPreference<SectionKey[]>(HIDDEN_SECTIONS_KEY, profileId.value);
  const layoutPref = () =>
    scopedPreference<Record<string, number>>(SECTION_LAYOUT_KEY, profileId.value);
  const anchorsPref = (id = profileId.value) =>
    scopedPreference<Record<string, { page: number; col: number; row: number; seq: number }>>(
      SECTION_ANCHORS_KEY,
      id,
    );

  function rebuild() {
    sections.value = character.value ? defaultSectionOrder(character.value) : [];
  }

  async function load() {
    const [hidden, layout, anchorData] = await Promise.all([
      hiddenPref().get([]),
      layoutPref().get({}),
      anchorsPref().get({}),
    ]);
    hiddenKeys.value = hidden;
    layoutIndices.value = layout;
    anchors.value = anchorData;
    nextSeq = Object.values(anchors.value).reduce((max, p) => Math.max(max, p.seq ?? 0), 0) + 1;
    rebuild();
  }

  onMounted(load);
  watch(character, rebuild);
  // Switching the active profile swaps in a whole different saved layout. Flush
  // any pending anchor save (to the profile it belongs to) first, then reload.
  watch(profileId, () => {
    flushAnchors();
    void load();
  });

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
    void hiddenPref().set(hiddenKeys.value);
    // A hidden card shouldn't keep a stale placement; it re-joins the flow when
    // shown again.
    if (hidden) clearAnchor(key);
  }

  /** Set a section's layout option directly. The sheet passes the next VIABLE
   * index (an option that would overflow a page is skipped), so this just stores
   * and persists the chosen index. */
  function setLayout(key: SectionKey, index: number) {
    const count = sectionLayoutCount(key);
    if (count <= 1) return;
    const clamped = Math.min(Math.max(0, Math.floor(index)), count - 1);
    if (clamped === (layoutIndices.value[key] ?? 0)) return;
    layoutIndices.value = { ...layoutIndices.value, [key]: clamped };
    void layoutPref().set(layoutIndices.value);
  }

  // Manual placements are set live during a drag (like reorder), so their save
  // is debounced too, to respect the storage.sync write-rate limit.
  let anchorTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingAnchors: Record<string, { page: number; col: number; row: number; seq: number }> | null = null;
  // The profile a pending save belongs to — captured at schedule time so a
  // profile switch mid-debounce still writes to the profile the change was for.
  let pendingProfileId = profileId.value;
  function flushAnchors() {
    if (anchorTimer !== undefined) {
      clearTimeout(anchorTimer);
      anchorTimer = undefined;
    }
    if (pendingAnchors) {
      void anchorsPref(pendingProfileId).set(pendingAnchors);
      pendingAnchors = null;
    }
  }
  function persistAnchors() {
    pendingAnchors = anchors.value;
    pendingProfileId = profileId.value;
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

  /** Compact the whole layout: pin every visible card to a new, gap-free cell
   * (computed by the caller) so the tidied arrangement sticks and persists. They
   * share one `seq` — the compacted cells don't collide, so recency is moot, and
   * a later single drag still outranks them. */
  function compact(cells: Record<string, { page: number; col: number; row: number }>) {
    const seq = nextSeq;
    nextSeq += 1;
    const next: Record<string, { page: number; col: number; row: number; seq: number }> = {};
    for (const [key, cell] of Object.entries(cells)) {
      next[key] = { page: cell.page, col: cell.col, row: cell.row, seq };
    }
    anchors.value = next;
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
    void hiddenPref().set([]);
    void layoutPref().set({});
    void anchorsPref().set({});
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
    compact,
    setLayout,
    reset,
    hide: (key: SectionKey) => setHidden(key, true),
    show: (key: SectionKey) => setHidden(key, false),
  };
}
