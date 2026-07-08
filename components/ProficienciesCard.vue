<script lang="ts" setup>
import { computed } from 'vue';
import type { CharacterProficiencies } from '@/services/dndbeyond/model';

const props = defineProps<{ proficiencies: CharacterProficiencies; columns?: number }>();

const groups = computed(() =>
  [
    { label: 'Languages', items: props.proficiencies.languages },
    { label: 'Weapons', items: props.proficiencies.weapons },
    { label: 'Armor', items: props.proficiencies.armor },
    { label: 'Tools', items: props.proficiencies.tools },
  ].filter((group) => group.items.length > 0),
);

// Split the groups into N balanced columns (from the chosen layout) so the wide
// layout uses its width; each column still spreads down the full height.
const columnCount = computed(() => Math.max(1, props.columns ?? 1));

// Multi-column layouts stack each category as a heading with one item per line;
// the single-column layout keeps the compact "Label: a, b, c" inline form.
const stacked = computed(() => columnCount.value > 1);

const columnGroups = computed(() => {
  const size = Math.ceil(groups.value.length / columnCount.value);
  return Array.from({ length: columnCount.value }, (_, index) =>
    groups.value.slice(index * size, (index + 1) * size),
  ).filter((column) => column.length > 0);
});
</script>

<template>
  <div class="profs" :class="{ 'profs--stacked': stacked }">
    <div v-for="(column, colIndex) in columnGroups" :key="colIndex" class="profs__column">
      <div
        v-for="group in column"
        :key="group.label"
        class="profs__group"
        :data-group="group.label"
      >
        <template v-if="stacked">
          <span class="profs__heading">{{ group.label }}</span>
          <ul class="profs__list">
            <li v-for="item in group.items" :key="item" class="profs__item">{{ item }}</li>
          </ul>
        </template>
        <template v-else>
          <span class="profs__label">{{ group.label }}:</span>
          <span class="profs__items">{{ group.items.join(', ') }}</span>
        </template>
      </div>
    </div>
    <p v-if="groups.length === 0" class="profs__empty">None</p>
  </div>
</template>

<style scoped>
.profs {
  display: flex;
  align-items: stretch;
  height: 100%;
}

.profs__column {
  flex: 1;
  min-width: 0;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  /* Spread the groups down the full card height so the wider layout doesn't
     leave empty space at the bottom; `gap` is the minimum spacing. */
  justify-content: space-between;
  gap: 6px;
}

.profs__column:first-child {
  padding-left: 0;
}

.profs__column:last-child {
  padding-right: 0;
}

/* A vertical rule between columns, like the skills / saves divider. */
.profs__column + .profs__column {
  border-left: 1px solid var(--p-primary-300, #d4d4d8);
}

/* The stacked format's headings + item lists are taller, so distributing them
   with space-between over-separates the categories; pack them from the top with
   a small fixed gap (and keep the column tops aligned) instead. Content stays
   left-aligned so the headings and bullets line up down each column. */
.profs--stacked .profs__column {
  align-items: flex-start;
  justify-content: flex-start;
  gap: 12px;
}

.profs__group {
  margin: 0;
  font-size: 13px;
  line-height: 1.3;
}

.profs__label {
  margin-right: 5px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.profs__items {
  color: #1c1c1e;
}

/* Stacked (multi-column) format: a category heading with one item per line. */
.profs__heading {
  display: block;
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.profs__list {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

.profs__item {
  color: #1c1c1e;
}

.profs__empty {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
