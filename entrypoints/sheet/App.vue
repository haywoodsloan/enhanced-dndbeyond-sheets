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
} from '@/utils/section-layout';
import { packedDropIndex, packSections, placementStyle, sheetTemplateRows } from '@/utils/pack-sections';
import {
  DEFAULT_FORMAT_ID,
  DEFAULT_MARGIN_ID,
  MARGIN_PRESETS,
  PAGE_FORMATS,
  mmToPx,
} from '@/utils/page-format';
import { DEFAULT_COLOR_ID, THEME_COLORS } from '@/utils/theme-color';
import { pageFormatPref, pageMarginPref, themeColorPref } from '@/utils/preferences';
import SectionCard from '@/components/SectionCard.vue';

/** Desk-coloured gap between the painted page rectangles, in px. */
const PAGE_GUTTER = 20;

const props = defineProps<{ characterId: number | null }>();

const { character, status, error } = useCharacter(toRef(props, 'characterId'));

const { sections: orderedSections, hiddenSections, layoutIndices, moveByIndex, cycleLayout, hide, show, reset: resetLayout } =
  useSectionLayout(character);

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
  '--page-inter-gap': `${2 * mmToPx(margin.value.mm) + PAGE_GUTTER}px`,
}));

const gridRef = ref<HTMLElement | null>(null);

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
const packed = computed(() => packSections(footprints.value, GRID_COLUMNS, rowsPerPage.value));
const pageCount = computed(() => packed.value.pages);
const placeStyles = computed(() =>
  packed.value.placements.map((placement) => placementStyle(placement, rowsPerPage.value)),
);
const gridTemplateRows = computed(() => sheetTemplateRows(pageCount.value, rowsPerPage.value));

// Position of each page rectangle in the backdrop layer.
const pageStride = computed(() => mmToPx(format.value.height) + PAGE_GUTTER);
const pageHeightPx = computed(() => mmToPx(format.value.height));

// Grow the paper to span all of its pages so a partly-filled last page still
// shows as a full sheet and the hidden-sections tray sits cleanly below it
// (rather than overlapping the last page rectangle that overhangs the content).
const sheetMinHeight = computed(
  () => (pageCount.value - 1) * pageStride.value + pageHeightPx.value,
);

// Drag-and-drop reordering of the section cards. `onReorder` moves the card in
// the model as the pointer passes each slot, so the grid reflows to preview the
// drop live; the packed placements recompute reactively from the new order, so
// the preview respects page breaks and cards never straddle a boundary mid-drag.
useCardDrag(gridRef, {
  onReorder: (from, to) => moveByIndex(from, to),
  // Resolve the drop slot by simulating the packer against the live footprints,
  // so the dragged card lands wherever it would actually render — including the
  // empty cells that a tall card leaves beside it.
  resolveDrop: (pointer, from) => {
    const grid = gridRef.value;
    if (!grid) return -1;
    const rect = grid.getBoundingClientRect();
    return packedDropIndex(
      pointer,
      footprints.value,
      {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        columns: GRID_COLUMNS,
        rowsPerPage: rowsPerPage.value,
        rowUnit: rowUnit.value,
        gap: GRID_GAP,
        interGap: 2 * mmToPx(margin.value.mm) + PAGE_GUTTER,
      },
      from,
    );
  },
});

// Glide the cards to their new slots when the order changes (a drag-reorder or
// hiding/showing a section) instead of snapping. Purely visual: the drag
// hit-testing measures layout offsets, so the animation's transform never
// perturbs where cards are computed to be. The packed placements recompute
// reactively from the order, so no manual re-pagination is needed.
useGridFlip(gridRef, orderedSections);

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

// Keep the print @page rule in sync with the selection so print matches screen.
let pageRule: HTMLStyleElement | null = null;
watchEffect(() => {
  if (typeof document === 'undefined') return;
  if (!pageRule) {
    pageRule = document.createElement('style');
    document.head.appendChild(pageRule);
  }
  pageRule.textContent = `@page { size: ${format.value.width}mm ${format.value.height}mm; margin: ${margin.value.mm}mm; }`;
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
          title="Reset layout to defaults"
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
      <main
        class="sheet"
        :style="[pageStyle, { '--sheet-min-height': `${sheetMinHeight}px` }]"
      >
        <div class="sheet__pages" aria-hidden="true">
          <div
            v-for="page in pageCount"
            :key="page"
            class="sheet__page"
            :style="{ top: `${(page - 1) * pageStride}px`, height: `${pageHeightPx}px` }"
          ></div>
        </div>

        <p v-if="characterId == null">
          No character selected. Open this from a D&amp;D Beyond character page.
        </p>

        <p v-else-if="status === 'idle' || status === 'loading'">Loading character…</p>

        <p v-else-if="status === 'error'" role="alert">
          Could not load character: {{ error }}
        </p>

        <template v-else-if="character">
          <div class="sheet__grid" ref="gridRef" :style="{ gridTemplateRows }">
            <SectionCard
              v-for="(section, index) in orderedSections"
              :key="section.key"
              :section="section"
              :span="sectionSpan(section.key, section.count, layoutIndices[section.key] ?? 0, rowsPerPage)"
              :place="placeStyles[index]"
              :character="character"
              :layout-count="sectionLayoutCount(section.key)"
              :layout-label="sectionLayoutLabel(section.key, layoutIndices[section.key] ?? 0)"
              @hide="hide"
              @cycle-layout="cycleLayout"
            />
          </div>
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
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: var(--page-width);
  min-height: var(--sheet-min-height, var(--page-height));
  padding: var(--page-margin);
  font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #1c1c1e;
  /* Tie borders and secondary text to the theme (lighter/darker shades). */
  --p-content-border-color: var(--p-primary-200, #e5e5e5);
  --p-text-muted-color: var(--p-primary-700, #6b7280);
}

/* WYSIWYG paper: one shadowed white page per printed page, behind the content. */
.sheet__pages {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.sheet__page {
  position: absolute;
  left: 0;
  right: 0;
  background: var(--paper);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.22);
}

.sheet__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  /* Rows are explicit tracks (built by `sheetTemplateRows`) so the inter-page
     gutter can differ from the in-row gap: row-gap is 0 and every gap lives in
     the template. Cards stretch to fill their multi-row span. */
  column-gap: var(--grid-gap, 12px);
  row-gap: 0;
  align-items: stretch;
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
  body {
    background: var(--paper);
  }

  .workspace {
    display: block;
  }

  .settings {
    display: none;
  }

  .sheet__pages {
    display: none;
  }

  .hidden-tray {
    display: none;
  }

  .sheet-area {
    padding: 0;
  }

  .sheet {
    width: auto;
    min-height: 0;
    padding: 0;
    background: var(--paper);
    box-shadow: none;
    /* `@page` supplies the physical page margins in print, so the grid's
       between-pages gutter must collapse to 0 — otherwise it accumulates down
       the document and pushes each later page's content toward the middle.
       `!important` beats the inline `--page-inter-gap` set for the screen. */
    --page-inter-gap: 0 !important;
  }
}
</style>
