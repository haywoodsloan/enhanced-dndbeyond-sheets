<script lang="ts" setup>
import { computed, nextTick, onUnmounted, ref, toRef, watch, watchEffect } from 'vue';
import Select from 'primevue/select';
import { palette, updatePrimaryPalette } from '@primevue/themes';
import { useCharacter } from '@/composables/useCharacter';
import { useSectionLayout } from '@/composables/useSectionLayout';
import { useCardDrag } from '@/composables/useCardDrag';
import { useGridFlip } from '@/composables/useGridFlip';
import { useStoredRef } from '@/composables/useStoredRef';
import { useProfiles } from '@/composables/useProfiles';
import {
  GRID_COLUMNS,
  GRID_GAP,
  CONTENT_FIT_SECTIONS,
  canCycleLayout,
  gridRowsPerPage,
  nextViableLayoutIndex,
  rowsForHeight,
  sectionLayoutCount,
  sectionLayoutLabel,
  sectionSpan,
  type SectionSpan,
} from '@/utils/layout/section-layout';
import {
  cellAtPoint,
  compactPlacements,
  packPositioned,
  packSections,
  placementPage,
  placementStyle,
  type PositionedFootprint,
} from '@/utils/layout/pack-sections';
import type { CharacterSection, SectionKey } from '@/services/dndbeyond/model';
import {
  DEFAULT_FORMAT_ID,
  DEFAULT_MARGIN_ID,
  MARGIN_PRESETS,
  PAGE_FORMATS,
  mmToPx,
} from '@/utils/layout/page-format';
import { DEFAULT_COLOR_ID, THEME_COLORS } from '@/utils/settings/theme-color';
import {
  PAGE_FORMAT_KEY,
  PAGE_MARGIN_KEY,
  THEME_COLOR_KEY,
} from '@/utils/settings/preferences';
import SectionCard from '@/components/SectionCard.vue';

/** Desk-coloured gap shown between the page sheets on screen, in px. */
const PAGE_GUTTER = 20;

/** One card placed on a specific page's grid, ready to render. */
interface PageEntry {
  section: CharacterSection;
  index: number;
  span: SectionSpan;
  place: { gridColumn: string; gridRow: string };
}

const props = defineProps<{ characterId: number | null }>();

const { character, status, error } = useCharacter(toRef(props, 'characterId'));

// Layout profiles: named snapshots of all the layout settings. The active id is
// threaded into every settings source below so switching profiles swaps in a
// whole different saved layout (and autosaves each profile as it's edited).
const {
  profiles,
  activeId: activeProfileId,
  create: createProfile,
  duplicate: duplicateProfile,
  rename: renameProfile,
  move: moveProfile,
  switchTo: switchProfile,
  remove: removeProfile,
} = useProfiles();

// Inline profile renaming: which row is being edited + its draft name. Commit on
// Enter or blur; cancel (discard) on Escape.
const editingProfileId = ref<string | null>(null);
const editingName = ref('');
// Inline delete confirmation: clicking a row's trash arms a confirm bar; the
// profile is removed only on the explicit confirm.
const confirmingDeleteId = ref<string | null>(null);

async function startRename(id: string, name: string) {
  confirmingDeleteId.value = null;
  editingProfileId.value = id;
  editingName.value = name;
  await nextTick();
  const input = document.querySelector<HTMLInputElement>('.profiles__rename-input');
  input?.focus();
  input?.select();
}

function commitRename() {
  if (editingProfileId.value) renameProfile(editingProfileId.value, editingName.value);
  editingProfileId.value = null;
}

function cancelRename() {
  editingProfileId.value = null;
}

function askDelete(id: string) {
  editingProfileId.value = null;
  confirmingDeleteId.value = id;
}

function confirmDelete() {
  if (confirmingDeleteId.value) removeProfile(confirmingDeleteId.value);
  confirmingDeleteId.value = null;
}

function cancelDelete() {
  confirmingDeleteId.value = null;
}

// Create a profile, then focus its name field so the user can name it right away.
async function onNewProfile() {
  const id = createProfile();
  const profile = profiles.value.find((entry) => entry.id === id);
  if (profile) await startRename(id, profile.name);
}

const {
  sections: orderedSections,
  hiddenSections,
  layoutIndices,
  anchors,
  placeCard,
  compact,
  setLayout,
  hide,
  show,
  reset: resetLayout,
} = useSectionLayout(character, activeProfileId);

// Page layout settings (page type, margins, theme color), scoped to the active
// profile so each profile keeps its own paper + accent.
const formatId = useStoredRef(PAGE_FORMAT_KEY, DEFAULT_FORMAT_ID, activeProfileId);
const marginId = useStoredRef(PAGE_MARGIN_KEY, DEFAULT_MARGIN_ID, activeProfileId);
const colorId = useStoredRef(THEME_COLOR_KEY, DEFAULT_COLOR_ID, activeProfileId);

// PrimeVue Select needs mutable arrays; the source lists stay readonly.
const formatOptions = [...PAGE_FORMATS];
const marginOptions = [...MARGIN_PRESETS];
const colorOptions = [...THEME_COLORS];

const format = computed(
  () => PAGE_FORMATS.find((entry) => entry.id === formatId.value) ?? PAGE_FORMATS[0],
);
const margin = computed(
  () => MARGIN_PRESETS.find((entry) => entry.id === marginId.value) ?? MARGIN_PRESETS[0],
);

// How many grid row-units fit on one printed page (varies with format/margin).
const rowsPerPage = computed(() => {
  const marginPx = mmToPx(margin.value.mm);
  const printWidth = mmToPx(format.value.width) - 2 * marginPx;
  const printHeight = mmToPx(format.value.height) - 2 * marginPx;
  return gridRowsPerPage(printWidth, printHeight);
});

// Row height chosen so the grid's rows:columns ratio matches the print area's
// height:width (margins removed) — i.e. roughly square cells.
const rowUnit = computed(() => {
  const marginPx = mmToPx(margin.value.mm);
  const printHeight = mmToPx(format.value.height) - 2 * marginPx;
  const rows = rowsPerPage.value;
  return (printHeight - (rows - 1) * GRID_GAP) / rows;
});

// On-screen size of one grid cell (its column and row pitch, gap included) so
// the packer can flow a bumped card the physically shorter way (forward vs
// backward) rather than always forward.
const cellSize = computed(() => {
  const marginPx = mmToPx(margin.value.mm);
  const printWidth = mmToPx(format.value.width) - 2 * marginPx;
  const colWidth = (printWidth - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;
  return { width: colWidth + GRID_GAP, height: rowUnit.value + GRID_GAP };
});

// Drive the paper geometry (and thus its aspect ratio) from the chosen format.
const pageStyle = computed(() => ({
  '--page-width': `${format.value.width}mm`,
  '--page-height': `${format.value.height}mm`,
  '--page-margin': `${margin.value.mm}mm`,
  '--row-unit': `${rowUnit.value}px`,
  '--grid-gap': `${GRID_GAP}px`,
  // The between-pages track = the two facing page margins (2×) plus the on-screen
  // desk gutter. Print keeps the margins but drops the gutter (`--page-gutter`
  // is zeroed there) so consecutive printed pages sit flush.
  // Desk-coloured space shown between the page sheets on screen (dropped in
  // print, where each page becomes its own physical sheet).
  '--page-gutter': `${PAGE_GUTTER}px`,
}));

const sheetRef = ref<HTMLElement | null>(null);

// A content-fit card (actions/spells/features/notes) measures its real content
// height and reports it here; `footprints` shrinks that card to fit. Cards that
// fill their height are ignored, so they keep their curated estimate.
const measuredHeights = ref<Record<string, number>>({});
function onMeasure(key: SectionKey, height: number) {
  if (!CONTENT_FIT_SECTIONS.has(key)) return;
  if (Math.abs((measuredHeights.value[key] ?? 0) - height) < 1) return;
  measuredHeights.value = { ...measuredHeights.value, [key]: height };
}

// Footprint (columns × row-units) of each visible card, packed into the grid.
// This replaces the margin-push paginator: cards are placed explicitly on real
// multi-row tracks, so a tall card's shorter neighbours fill the space beside it
// (no dead gaps) and a card that would straddle a page break is bumped whole to
// the next page. Page count, the row template, and each card's grid position all
// derive from this one pure computation, so a reorder reflows deterministically.
const footprints = computed(() =>
  orderedSections.value.map((section) => {
    const estimate = sectionSpan(
      section.key,
      section.count,
      layoutIndices.value[section.key] ?? 0,
      rowsPerPage.value,
    );
    // A content-fit card reports its real content height; shrink its footprint to
    // fit so a short list doesn't reserve a tall, half-empty card. Others fill
    // their height by design and have no measured entry (kept at the estimate);
    // so does every card before it measures (and in tests without a layout
    // engine).
    const measured = measuredHeights.value[section.key];
    if (measured === undefined) return estimate;
    return {
      cols: estimate.cols,
      rows: rowsForHeight(measured, rowUnit.value, GRID_GAP, estimate.rows),
    };
  }),
);
// Every card has a cell AND a recency — no placed-vs-regular distinction. A card
// the user moved uses its saved cell as its `home`; a card left alone uses its
// default (class-aware flow) cell, so untouched cards still auto-arrange. The
// positional packer seats cards most-recently-moved first, each at its home if
// free else just after — so a freshly-dragged card takes its cell and the others
// flow aside, while the blank a moved card leaves behind stays empty.
const defaultPlacements = computed(() =>
  packSections(footprints.value, GRID_COLUMNS, rowsPerPage.value),
);
const positionedFootprints = computed<PositionedFootprint[]>(() => {
  const perPage = rowsPerPage.value;
  const count = orderedSections.value.length;
  return orderedSections.value.map((section, index) => {
    const base = footprints.value[index];
    const moved = anchors.value[section.key];
    const home = moved
      ? { col: moved.col, row: moved.page * perPage + moved.row }
      : defaultPlacements.value.placements[index];
    // Every card carries a recency: one the user moved uses its saved `seq` (≥ 1);
    // one left alone keeps a negative reading-order baseline, so a freshly-dragged
    // card always outranks the stationary ones — it takes its cell and they flow
    // aside.
    const priority = moved ? moved.seq : index - count;
    return {
      cols: base.cols,
      rows: base.rows,
      home: { col: home.col, row: home.row },
      priority,
    };
  });
});
const packed = computed(() =>
  packPositioned(positionedFootprints.value, GRID_COLUMNS, rowsPerPage.value, cellSize.value),
);
const pageCount = computed(() => packed.value.pages);

// Group the packed cards by the page they land on. Each page then renders as its
// OWN grid container (a real, separate sheet) rather than all cards living in one
// tall grid the print engine has to fragment across pages. That is the crux of
// the reliable print layout: because no grid ever spans a page break, the engine
// can't drift the row tracks or drop the between-pages spacing, and every page's
// margin comes straight from its own container padding.
const pages = computed<PageEntry[][]>(() => {
  const perPage = rowsPerPage.value;
  const grouped: PageEntry[][] = Array.from({ length: pageCount.value }, () => []);
  packed.value.placements.forEach((placement, index) => {
    grouped[placementPage(placement, perPage)].push({
      section: orderedSections.value[index],
      index,
      span: footprints.value[index],
      place: placementStyle(placement, perPage),
    });
  });
  return grouped;
});

// One page's grid is exactly `rowsPerPage` row-unit tracks tall (its in-row
// `row-gap`s make them sum to the page's printable height).
const pageGridRows = computed(() => `repeat(${rowsPerPage.value}, var(--row-unit))`);

// Drag placement of the section cards. Dragging moves the card's cell live as
// the pointer moves; the packed placements recompute reactively, so the preview
// respects page breaks and cards never straddle a boundary mid-drag.
// Geometry of the first page's grid, anchoring the packer coordinates: its
// top-left is where content row 0 begins and its width is the content width.
function dragGeometry() {
  const grid = sheetRef.value?.querySelector('.page__grid');
  if (!grid) return null;
  const rect = grid.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    columns: GRID_COLUMNS,
    rowsPerPage: rowsPerPage.value,
    rowUnit: rowUnit.value,
    gap: GRID_GAP,
    interGap: 2 * mmToPx(margin.value.mm) + PAGE_GUTTER,
  };
}

const { dragging } = useCardDrag(sheetRef, {
  // Move the dragged card's cell to wherever the pointer is and stamp it newest,
  // so the packer seats it first: it takes that cell and any card already there
  // flows aside. Any spot on the grid is a valid drop.
  onPlace: (key, cell) => placeCard(key as SectionKey, cell),
  // Resolve the cell under the pointer, clamped so the card stays whole and
  // within the existing pages (no blank page from dropping past the last sheet).
  // Returns null when the card already sits there, so we don't churn its recency.
  resolveCell: (pointer, key) => {
    const geometry = dragGeometry();
    if (!geometry) return null;
    const index = orderedSections.value.findIndex((section) => section.key === key);
    const footprint = footprints.value[index];
    if (!footprint) return null;
    const perPage = rowsPerPage.value;
    const cell = cellAtPoint(pointer, geometry);
    const w = Math.min(Math.max(1, footprint.cols), GRID_COLUMNS);
    const h = Math.min(Math.max(1, footprint.rows), perPage);
    const col = Math.min(Math.max(0, cell.col), GRID_COLUMNS - w);
    const page = Math.min(Math.floor(cell.row / perPage), Math.max(0, pageCount.value - 1));
    const rowInPage = Math.min(Math.max(0, cell.row % perPage), perPage - h);
    const current = packed.value.placements[index];
    if (current && current.col === col && current.row === page * perPage + rowInPage) {
      return null;
    }
    return { page, col, row: rowInPage };
  },
});

// Changing a card's layout pins it to its CURRENT top-left cell first, so the
// resized card keeps its spot (growing/shrinking toward the bottom-right) and the
// neighbours flow to make room, instead of the card jumping to a fresh default
// position.
const layoutChanging = ref(false);
function onCycleLayout(key: SectionKey) {
  const index = orderedSections.value.findIndex((section) => section.key === key);
  if (index < 0) return;
  const perPage = rowsPerPage.value;
  const current = layoutIndices.value[key] ?? 0;
  // Skip any layout that would overflow a page — advance to the next option that
  // still fits. If none does, there's nothing to switch to (the toggle is
  // disabled), so bail.
  const nextIndex = nextViableLayoutIndex(key, current, orderedSections.value[index].count, perPage);
  if (nextIndex === current) return;

  // Capture where the card sits RIGHT NOW (its top-left) — the cell the user
  // sees, including any shrink-to-fit. Read it BEFORE clearing the measured
  // height below: clearing re-packs the card at its taller estimate, which can
  // bump it to a different row/page, and we want to keep the visible spot.
  const placement = packed.value.placements[index];
  const topLeft = placement
    ? {
        page: Math.floor(placement.row / perPage),
        col: placement.col,
        rowInPage: placement.row % perPage,
      }
    : null;

  // The new layout renders at a different size — drop the stale measured height
  // so the footprint uses the fresh estimate until the card re-measures.
  if (key in measuredHeights.value) {
    const nextHeights = { ...measuredHeights.value };
    delete nextHeights[key];
    measuredHeights.value = nextHeights;
  }

  // Switch to that next viable layout, then pin the card back at the same
  // top-left — clamped to the new size so a now-wider/taller card still fits its
  // page. `layoutChanging` suppresses the glide so the resize applies at once.
  layoutChanging.value = true;
  setLayout(key, nextIndex);
  if (topLeft) {
    const span = footprints.value[index];
    const w = Math.min(Math.max(1, span.cols), GRID_COLUMNS);
    const h = Math.min(Math.max(1, span.rows), perPage);
    placeCard(key, {
      page: topLeft.page,
      col: Math.min(topLeft.col, GRID_COLUMNS - w),
      row: Math.min(topLeft.rowInPage, perPage - h),
    });
  }
  void nextTick(() => {
    layoutChanging.value = false;
  });
}

// Glide cards to their new slots when the order OR a manual placement changes —
// a drag-reorder or hiding/showing a section — instead of snapping. A layout
// toggle is suppressed (`() => layoutChanging.value`, set by `onCycleLayout`): it
// pins + resizes the card in place, which touches `anchors`, but animating it
// would snap the toggled card's size while its neighbours glided (disjointed), so
// it applies at once. Purely visual: the drag hit-testing reads packer geometry,
// not live rects, so an in-flight glide never skews the drop target.
useGridFlip(sheetRef, () => [orderedSections.value, anchors.value], () => layoutChanging.value);

/** Open the browser's print dialog; the print stylesheet hides the settings
 * panel and desk so only the sheet prints. */
function printSheet() {
  window.print();
}

/** Compact the layout: slide every card up and left into the open space so the
 * sheet uses the fewest pages, keeping each card's current reading order. */
function compactLayout() {
  const perPage = rowsPerPage.value;
  const compacted = compactPlacements(packed.value.placements, GRID_COLUMNS, perPage);
  const cells: Record<string, { page: number; col: number; row: number }> = {};
  compacted.forEach((placement, index) => {
    cells[orderedSections.value[index].key] = {
      page: Math.floor(placement.row / perPage),
      col: placement.col,
      row: placement.row % perPage,
    };
  });
  compact(cells);
}

// Apply the selected primary theme color across the document. Wrapped
// defensively because the update needs PrimeVue's theme service to be present.
watch(
  colorId,
  (id) => {
    const color = THEME_COLORS.find((entry) => entry.id === id) ?? THEME_COLORS[0];
    try {
      updatePrimaryPalette(palette(color.base));
    } catch {
      // Theme service unavailable (e.g. in unit tests); skip the accent update.
    }
  },
  { immediate: true },
);

// Drive the print @page size from the selection. Margin is 0 so the sheet's own
// padding provides the printed margin — that keeps the app's Margins setting in
// control no matter what the browser's print dialog margin is set to (Default
// and None both defer to it; only Minimum/Custom, which force a physical margin,
// can still shrink the page).
let pageRule: HTMLStyleElement | null = null;
watchEffect(() => {
  if (typeof document === 'undefined') return;
  if (!pageRule) {
    pageRule = document.createElement('style');
    document.head.appendChild(pageRule);
  }
  pageRule.textContent = `@page { size: ${format.value.width}mm ${format.value.height}mm; margin: 0; }`;
});
onUnmounted(() => {
  pageRule?.remove();
  pageRule = null;
});
</script>

<template>
  <div class="workspace">
    <div class="sidebar">
      <aside class="settings">
      <h2 class="settings__title">Page layout</h2>

      <label class="settings__field">
        <span class="settings__label">Page type</span>
        <Select
          v-model="formatId"
          :options="formatOptions"
          option-label="name"
          option-value="id"
          class="settings__control"
        />
      </label>

      <label class="settings__field">
        <span class="settings__label">Margins</span>
        <Select
          v-model="marginId"
          :options="marginOptions"
          option-label="name"
          option-value="id"
          class="settings__control"
        />
      </label>

      <label class="settings__field">
        <span class="settings__label">Theme color</span>
        <Select
          v-model="colorId"
          :options="colorOptions"
          option-label="name"
          option-value="id"
          class="settings__control"
        />
      </label>

      <div class="settings__actions">
        <button
          type="button"
          class="settings__button settings__button--print"
          @click="printSheet"
        >
          <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path
              d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
            />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <span>Print</span>
        </button>
        <button
          type="button"
          class="settings__button settings__button--compact"
          v-tooltip.top="{ value: 'Compact layout', showDelay: 500 }"
          aria-label="Compact the layout into the fewest pages"
          @click="compactLayout"
        >
          <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
        <button
          type="button"
          class="settings__button settings__button--reset"
          v-tooltip.top="{ value: 'Reset layout', showDelay: 500 }"
          aria-label="Reset layout to defaults"
          @click="resetLayout"
        >
          <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>
    </aside>

      <aside class="profiles">
      <h2 class="settings__title">Profiles</h2>
      <ul class="profiles__list">
        <li
          v-for="(profile, index) in profiles"
          :key="profile.id"
          class="profiles__item"
          :class="{ 'profiles__item--active': profile.id === activeProfileId }"
        >
          <input
            v-if="editingProfileId === profile.id"
            v-model="editingName"
            class="profiles__rename-input"
            type="text"
            :aria-label="`Rename profile ${profile.name}`"
            @keyup.enter="commitRename"
            @keyup.esc="cancelRename"
            @blur="commitRename"
          />
          <div v-else-if="confirmingDeleteId === profile.id" class="profiles__confirm">
            <span class="profiles__confirm-text">Delete “{{ profile.name }}”?</span>
            <button
              type="button"
              class="profiles__confirm-yes"
              :aria-label="`Confirm deleting profile ${profile.name}`"
              @click="confirmDelete"
            >
              <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button
              type="button"
              class="profiles__confirm-no"
              :aria-label="`Cancel deleting profile ${profile.name}`"
              @click="cancelDelete"
            >
              <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <template v-else>
            <div class="profiles__reorder">
              <button
                type="button"
                class="profiles__move"
                :disabled="index === 0"
                v-tooltip.top="{ value: 'Move up', showDelay: 500 }"
                :aria-label="`Move profile ${profile.name} up`"
                @click="moveProfile(profile.id, -1)"
              >
                <svg class="profiles__move-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="6 15 12 9 18 15" />
                </svg>
              </button>
              <button
                type="button"
                class="profiles__move"
                :disabled="index === profiles.length - 1"
                v-tooltip.bottom="{ value: 'Move down', showDelay: 500 }"
                :aria-label="`Move profile ${profile.name} down`"
                @click="moveProfile(profile.id, 1)"
              >
                <svg class="profiles__move-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="profiles__switch"
              :aria-current="profile.id === activeProfileId ? 'true' : undefined"
              @click="switchProfile(profile.id)"
            >
              {{ profile.name }}
            </button>
            <button
              type="button"
              class="profiles__rename"
              v-tooltip.top="{ value: 'Rename profile', showDelay: 500 }"
              :aria-label="`Rename profile ${profile.name}`"
              @click="startRename(profile.id, profile.name)"
            >
              <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>
            <button
              type="button"
              class="profiles__dupe"
              v-tooltip.top="{ value: 'Duplicate profile', showDelay: 500 }"
              :aria-label="`Duplicate profile ${profile.name}`"
              @click="duplicateProfile(profile.id)"
            >
              <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button
              type="button"
              class="profiles__delete"
              :disabled="profiles.length <= 1"
              v-tooltip.top="{ value: 'Delete profile', showDelay: 500 }"
              :aria-label="`Delete profile ${profile.name}`"
              @click="askDelete(profile.id)"
            >
              <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </template>
        </li>
      </ul>
      <button type="button" class="settings__button profiles__new" @click="onNewProfile">
        <svg class="settings__button-icon" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>New profile</span>
      </button>
      </aside>
    </div>

    <div class="sheet-area">
      <main class="sheet" ref="sheetRef" :style="pageStyle">
        <p v-if="characterId == null" class="sheet__message">
          No character selected. Open this from a D&amp;D Beyond character page.
        </p>

        <p v-else-if="status === 'idle' || status === 'loading'" class="sheet__message">
          Loading character…
        </p>

        <p v-else-if="status === 'error'" class="sheet__message" role="alert">
          Could not load character: {{ error }}
        </p>

        <template v-else-if="character">
          <!-- Each page is its own sheet-sized container holding a one-page-tall
               grid; a `break-after: page` (in print) puts each on its own
               physical sheet, so no grid is ever split across a page break. -->
          <section v-for="(pageCards, p) in pages" :key="`page-${p}`" class="page">
            <div class="page__grid" :style="{ gridTemplateRows: pageGridRows }">
              <SectionCard
                v-for="entry in pageCards"
                :key="entry.section.key"
                :section="entry.section"
                :span="entry.span"
                :place="entry.place"
                :character="character"
                :layout-count="sectionLayoutCount(entry.section.key)"
                :layout-label="sectionLayoutLabel(entry.section.key, layoutIndices[entry.section.key] ?? 0)"
                :can-cycle-layout="canCycleLayout(entry.section.key, layoutIndices[entry.section.key] ?? 0, entry.section.count, rowsPerPage)"
                @hide="hide"
                @cycle-layout="onCycleLayout"
                @measure="onMeasure"
              />
            </div>
          </section>
        </template>
      </main>

      <section
        v-if="character && hiddenSections.length"
        class="hidden-tray"
        :style="pageStyle"
        aria-label="Hidden sections"
      >
        <p class="hidden-tray__label">Hidden — not printed</p>
        <div class="hidden-tray__grid">
          <SectionCard
            v-for="section in hiddenSections"
            :key="section.key"
            :section="section"
            :span="sectionSpan(section.key, section.count, layoutIndices[section.key] ?? 0, rowsPerPage)"
            :character="character"
            hidden
            @show="show"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style>
:root {
  --page-gap: 20px;
  --desk: #dcdce1;
  --paper: #ffffff;
}

body {
  margin: 0;
  background: var(--desk);
}

.workspace {
  display: flex;
  align-items: flex-start;
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 24px;
  flex: none;
  box-sizing: border-box;
  width: 280px;
  margin: 24px;
  max-height: calc(100vh - 48px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings,
.profiles {
  box-sizing: border-box;
  padding: 20px 16px;
  background: var(--paper);
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #1c1c1e;
}

.settings__title {
  margin: 0 0 16px;
  font-size: 15px;
  color: var(--p-primary-color);
}

.settings__field {
  display: block;
  margin-bottom: 14px;
}

.settings__label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #555;
}

.settings__control {
  width: 100%;
}

/* Print + reset row at the foot of the panel: the reset is a fixed square, the
   print button flexes to fill the rest of the row. */
.settings__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.settings__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--p-primary-300, #d4d4d8);
  border-radius: 8px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.settings__button--reset,
.settings__button--compact {
  flex: none;
  width: 40px;
  padding: 0;
  background: var(--paper);
  color: var(--p-primary-700, #6b7280);
}

.settings__button--reset:hover,
.settings__button--compact:hover {
  border-color: var(--p-primary-400, #a1a1aa);
  color: var(--p-primary-color);
}

/* Profiles panel: the list of saved layout profiles, a switch button per row
   (the active one filled), a delete button, and a New profile button. */
.profiles__list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profiles__item {
  display: flex;
  gap: 6px;
}

.profiles__switch {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid var(--p-primary-300, #d4d4d8);
  border-radius: 8px;
  background: var(--paper);
  color: #1c1c1e;
  font: inherit;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.profiles__switch:hover {
  border-color: var(--p-primary-400, #a1a1aa);
}

.profiles__item--active .profiles__switch {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: #fff;
  font-weight: 600;
}

.profiles__rename,
.profiles__dupe,
.profiles__delete,
.profiles__confirm-yes,
.profiles__confirm-no {
  flex: none;
  width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--p-primary-300, #d4d4d8);
  border-radius: 8px;
  background: var(--paper);
  color: var(--p-primary-700, #6b7280);
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}

.profiles__rename:hover,
.profiles__dupe:hover {
  border-color: var(--p-primary-400, #a1a1aa);
  color: var(--p-primary-color);
}

.profiles__delete:enabled:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.profiles__delete:disabled {
  cursor: default;
  opacity: 0.4;
}

/* Up/down reorder controls stacked at the left of each row. */
.profiles__reorder {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.profiles__move {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--p-primary-300, #d4d4d8);
  border-radius: 5px;
  background: var(--paper);
  color: var(--p-primary-700, #6b7280);
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}

.profiles__move:enabled:hover {
  border-color: var(--p-primary-400, #a1a1aa);
  color: var(--p-primary-color);
}

.profiles__move:disabled {
  cursor: default;
  opacity: 0.35;
}

.profiles__move-icon {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Inline delete confirmation bar (replaces the row while confirming). */
.profiles__confirm {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.profiles__confirm-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #1c1c1e;
}

.profiles__confirm-yes {
  border-color: #ef4444;
  color: #ef4444;
}

.profiles__confirm-yes:hover {
  background: #ef4444;
  color: #fff;
}

.profiles__confirm-no:hover {
  border-color: var(--p-primary-400, #a1a1aa);
  color: var(--p-primary-color);
}

.profiles__rename-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--p-primary-color);
  border-radius: 8px;
  background: var(--paper);
  color: #1c1c1e;
  font: inherit;
  outline: none;
}

.profiles__new {
  width: 100%;
  flex: none;
  background: var(--paper);
  color: var(--p-primary-700, #6b7280);
}

.profiles__new:hover {
  border-color: var(--p-primary-400, #a1a1aa);
  color: var(--p-primary-color);
}

.settings__button--print {
  flex: 1;
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: #fff;
}

.settings__button--print:hover {
  background: var(--p-primary-600);
  border-color: var(--p-primary-600);
}

.settings__button-icon {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sheet-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
}

/* Parking area for hidden sections: sits on the desk below the pages so it
   reads as "off the page" (no paper rectangle/shadow) and never takes up print
   space. Hidden from the actual print output. */
.hidden-tray {
  width: var(--page-width);
  max-width: 100%;
  margin-top: var(--page-gap, 20px);
}

.hidden-tray__label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-primary-700, #6b7280);
}

.hidden-tray__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--grid-gap, 12px);
  align-items: start;
}

.sheet {
  box-sizing: border-box;
  width: var(--page-width);
  font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #1c1c1e;
  /* Tie borders and secondary text to the theme (lighter/darker shades). */
  --p-content-border-color: var(--p-primary-200, #e5e5e5);
  --p-text-muted-color: var(--p-primary-700, #6b7280);
}

.sheet__message {
  margin: 0;
  padding: var(--page-margin);
}

/* One WYSIWYG paper sheet per printed page: a real, self-contained container
   with its own one-page grid. Its padding IS the page margin, so the printed
   margin is exact and identical on every page (no fragmented-grid drift). */
.page {
  box-sizing: border-box;
  width: 100%;
  height: var(--page-height);
  padding: var(--page-margin);
  background: var(--paper);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.22);
}

.page:not(:last-child) {
  /* Desk-coloured gap between the sheets on screen (removed in print). */
  margin-bottom: var(--page-gutter, 20px);
}

.page__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  /* Row-units are explicit tracks; the in-row gaps are a real `row-gap`. Because
     each page is its OWN grid (never fragmented across a page break), there is no
     page-boundary gap to special-case. Cards stretch to fill their span. */
  column-gap: var(--grid-gap, 12px);
  row-gap: var(--grid-gap, 12px);
  align-items: stretch;
  height: 100%;
}

/* Keep a card whole rather than letting it split across a page break. */
.card {
  break-inside: avoid;
}

/* While dragging, dim the card in its original slot but keep its space so the
   other cards reflow around it to preview the drop; a floating clone (appended
   to <body>) follows the cursor. */
.card--drag-source {
  opacity: 0.4;
}

.card--drag-clone {
  cursor: grabbing;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
}

@media print {
  .workspace {
    display: block;
  }

  .sidebar {
    display: none;
  }

  .hidden-tray {
    display: none;
  }

  .sheet-area {
    /* Drop the on-screen flex centering so the sheet sits at the page origin. */
    display: block;
    padding: 0;
  }

  .sheet {
    width: var(--page-width);
    margin: 0;
  }

  .page {
    /* `@page { margin: 0 }` makes each physical page the full paper size, and
       each `.page` is one paper tall with its own `--page-margin` padding, so
       the printed margins are exact and equal on every page. `break-after: page`
       puts each container on its own sheet — no grid is fragmented, so nothing
       drifts between pages. `overflow: hidden` clips any sub-pixel spill so a
       page can't bleed onto the next sheet (screen keeps it visible so a card
       gliding in from another page isn't clipped mid-animation). */
    box-shadow: none;
    margin: 0;
    overflow: hidden;
    break-after: page;
  }

  .page:last-child {
    break-after: auto;
  }
}
</style>
