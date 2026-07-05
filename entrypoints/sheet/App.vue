<script lang="ts" setup>
import { computed, toRef } from 'vue';
import { useCharacter } from '@/composables/useCharacter';
import { defaultSectionOrder } from '@/utils/section-order';
import { sectionSize } from '@/utils/section-layout';
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

const orderedSections = computed(() =>
  character.value ? defaultSectionOrder(character.value) : [],
);
</script>

<template>
  <main class="sheet">
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

      <div class="sheet__grid">
        <SectionCard
          v-for="section in orderedSections"
          :key="section.key"
          :section="section"
          :size="sectionSize(section.key)"
          :character="character"
        />
      </div>
    </template>
  </main>
</template>

<style>
:root {
  /* Paper geometry — the on-screen view mirrors the printed page. */
  --page-width: 8.5in;
  --page-height: 11in;
  --page-margin: 0.5in;
  --page-gap: 20px;
  --desk: #dcdce1;
  --paper: #ffffff;
}

body {
  margin: 0;
  padding: 24px 0;
  background: var(--desk);
}

.sheet {
  box-sizing: border-box;
  width: var(--page-width);
  margin: 0 auto;
  padding: var(--page-margin);
  font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #1c1c1e;
  /* WYSIWYG paper: white pages stacked with a small gutter at each break. */
  background: repeating-linear-gradient(
    to bottom,
    var(--paper) 0,
    var(--paper) var(--page-height),
    var(--desk) var(--page-height),
    var(--desk) calc(var(--page-height) + var(--page-gap))
  );
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
}

.sheet__header {
  margin-bottom: 16px;
}

.sheet__header h1 {
  margin: 0 0 2px;
  font-size: 22px;
}

.sheet__header p {
  margin: 0;
  color: #666;
}

.sheet__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  align-items: start;
}

/* Keep a card whole rather than letting it split across a page break. */
.card {
  break-inside: avoid;
}

/* Actual print: let the browser paginate and drop the on-screen desk/gutters. */
@page {
  size: Letter;
  margin: var(--page-margin);
}

@media print {
  body {
    padding: 0;
    background: var(--paper);
  }

  .sheet {
    width: auto;
    margin: 0;
    padding: 0;
    background: var(--paper);
    box-shadow: none;
  }
}
</style>
