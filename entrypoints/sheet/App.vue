<script lang="ts" setup>
import { computed, nextTick, onUnmounted, ref, toRef, watch, watchEffect } from 'vue';
import Select from 'primevue/select';
import { palette, updatePrimaryPalette } from '@primevue/themes';
import { useCharacter } from '@/composables/useCharacter';
import { useSheetPagination } from '@/composables/useSheetPagination';
import { useSectionLayout } from '@/composables/useSectionLayout';
import { useSortableGrid } from '@/composables/useSortableGrid';
import { useStoredRef } from '@/composables/useStoredRef';
import { GRID_GAP, gridRowsPerPage, sectionSpan } from '@/utils/section-layout';
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

const props = defineProps<{ characterId: number | null }>();

const { character, status, error } = useCharacter(toRef(props, 'characterId'));

const subtitle = computed(() => {
  const loaded = character.value;
  if (!loaded) return '';
  const classes = loaded.classes
    .map((cls) =>
      cls.subclass ? `${cls.name} ${cls.level} (${cls.subclass})` : `${cls.name} ${cls.level}`,
    )
    .join(' / ');
  return [loaded.race, classes].filter(Boolean).join(' · ');
});

const { sections: orderedSections, hiddenSections, moveByIndex, hide, show } =
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

// Row height chosen so the grid's rows:columns ratio matches the print area's
// height:width (margins removed) — i.e. roughly square cells.
const rowUnit = computed(() => {
  const marginPx = mmToPx(margin.value.mm);
  const printWidth = mmToPx(format.value.width) - 2 * marginPx;
  const printHeight = mmToPx(format.value.height) - 2 * marginPx;
  const rows = gridRowsPerPage(printWidth, printHeight);
  return (printHeight - (rows - 1) * GRID_GAP) / rows;
});

// Drive the paper geometry (and thus its aspect ratio) from the chosen format.
const pageStyle = computed(() => ({
  '--page-width': `${format.value.width}mm`,
  '--page-height': `${format.value.height}mm`,
  '--page-margin': `${margin.value.mm}mm`,
  '--row-unit': `${rowUnit.value}px`,
  '--grid-gap': `${GRID_GAP}px`,
}));

const pageMetrics = computed(() => ({
  band: mmToPx(format.value.height),
  gutter: 20,
  margin: mmToPx(margin.value.mm),
}));

const sheetRef = ref<HTMLElement | null>(null);
const gridRef = ref<HTMLElement | null>(null);

const { pageCount, apply: repaginate } = useSheetPagination(
  sheetRef,
  gridRef,
  () => pageMetrics.value,
  () => character.value,
);

// Position of each page rectangle in the backdrop layer.
const pageStride = computed(() => pageMetrics.value.band + pageMetrics.value.gutter);
const pageHeightPx = computed(() => pageMetrics.value.band);

// Grow the paper to span all of its pages so a partly-filled last page still
// shows as a full sheet and the hidden-sections tray sits cleanly below it
// (rather than overlapping the last page rectangle that overhangs the content).
const sheetMinHeight = computed(
  () => (pageCount.value - 1) * pageStride.value + pageHeightPx.value,
);

// Drag-and-drop reordering of the section cards. `onDragMove` re-paginates as
// the preview shifts so cards never straddle a page boundary mid-drag; on drop,
// nextTick lets SortableJS finish its DOM move before we persist + re-paginate.
useSortableGrid(gridRef, {
  onReorder: (from, to) => {
    void nextTick(() => {
      moveByIndex(from, to);
      void nextTick(repaginate);
    });
  },
  onDragMove: () => repaginate(),
});

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
    </aside>

    <div class="sheet-area">
      <main
        class="sheet"
        ref="sheetRef"
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
          <header class="sheet__header">
            <h1>{{ character.name }}</h1>
            <p>{{ subtitle }}</p>
          </header>

          <div class="sheet__grid" ref="gridRef">
            <SectionCard
              v-for="section in orderedSections"
              :key="section.key"
              :section="section"
              :span="sectionSpan(section.key, section.count)"
              :character="character"
              @hide="hide"
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
            :span="sectionSpan(section.key, section.count)"
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

.sheet__header {
  margin-bottom: 16px;
}

.sheet__header h1 {
  margin: 0 0 2px;
  font-size: 22px;
  color: var(--p-primary-color);
}

.sheet__header p {
  margin: 0;
  color: var(--p-primary-700, #666);
}

.sheet__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-flow: row;
  gap: var(--grid-gap, 12px);
  align-items: start;
}

/* Keep a card whole rather than letting it split across a page break. */
.card {
  break-inside: avoid;
}

/* While dragging, hide the card in its original slot but keep its space so the
   other cards reposition around it — only the cursor preview is rendered. */
.sortable-ghost {
  visibility: hidden;
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
  }
}
</style>
