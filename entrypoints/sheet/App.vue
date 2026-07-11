<script lang="ts" setup>
import { computed, onUnmounted, ref, toRef, watch, watchEffect } from 'vue';
import Select from 'primevue/select';
import { palette, updatePrimaryPalette } from '@primevue/themes';
import { useCharacter } from '@/composables/useCharacter';
import { useSectionLayout } from '@/composables/useSectionLayout';
import { useCardDrag } from '@/composables/useCardDrag';
import { useGridFlip } from '@/composables/useGridFlip';
import { useStoredRef } from '@/composables/useStoredRef';
import {
  GRID_COLUMNS,
  GRID_GAP,
  gridRowsPerPage,
  sectionLayoutCount,
  sectionLayoutLabel,
  sectionSpan,
  type SectionSpan,
} from '@/utils/layout/section-layout';
import {
  cellAtPoint,
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
import { pageFormatPref, pageMarginPref, themeColorPref } from '@/utils/settings/preferences';
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

const {
  sections: orderedSections,
  hiddenSections,
  layoutIndices,
  anchors,
  placeCard,
  cycleLayout,
  hide,
  show,
  reset: resetLayout,
} = useSectionLayout(character);

// Page layout settings (page type, margins, theme color), persisted locally.
const formatId = useStoredRef(pageFormatPref, DEFAULT_FORMAT_ID);
const marginId = useStoredRef(pageMarginPref, DEFAULT_MARGIN_ID);
const colorId = useStoredRef(themeColorPref, DEFAULT_COLOR_ID);

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

// Footprint (columns × row-units) of each visible card, packed into the grid.
// This replaces the margin-push paginator: cards are placed explicitly on real
// multi-row tracks, so a tall card's shorter neighbours fill the space beside it
// (no dead gaps) and a card that would straddle a page break is bumped whole to
// the next page. Page count, the row template, and each card's grid position all
// derive from this one pure computation, so a reorder reflows deterministically.
const footprints = computed(() =>
  orderedSections.value.map((section) =>
    sectionSpan(
      section.key,
      section.count,
      layoutIndices.value[section.key] ?? 0,
      rowsPerPage.value,
    ),
  ),
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
  packPositioned(positionedFootprints.value, GRID_COLUMNS, rowsPerPage.value),
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

// Glide cards to their new slots when the order OR a manual placement changes —
// hiding/showing a section or a placement outside a drag — instead of snapping.
// During an ACTIVE drag the glide is suppressed (`() => dragging.value`) so the
// live reflow snaps instantly and cards flow out of the way right under the
// cursor rather than gliding a step behind. A card's own layout toggle is
// deliberately NOT in the trigger: the toggled card would resize instantly while
// its neighbours glided, which looks disjointed, so a layout change reflows at
// once. Purely visual: the drag hit-testing measures layout offsets, so the
// animation's transform never perturbs where cards are computed to be.
useGridFlip(sheetRef, () => [orderedSections.value, anchors.value]);

/** Open the browser's print dialog; the print stylesheet hides the settings
 * panel and desk so only the sheet prints. */
function printSheet() {
  window.print();
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
          class="settings__button settings__button--reset"
          v-tooltip.top="{ value: 'Reset layout to defaults', showDelay: 500 }"
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
                @hide="hide"
                @cycle-layout="cycleLayout"
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

.settings {
  position: sticky;
  top: 24px;
  flex: none;
  box-sizing: border-box;
  width: 240px;
  margin: 24px;
  max-height: calc(100vh - 48px);
  overflow: auto;
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

.settings__button--reset {
  flex: none;
  width: 40px;
  padding: 0;
  background: var(--paper);
  color: var(--p-primary-700, #6b7280);
}

.settings__button--reset:hover {
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

  .settings {
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
