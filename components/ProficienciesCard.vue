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
const columnGroups = computed(() => {
  const count = Math.max(1, props.columns ?? 1);
  const size = Math.ceil(groups.value.length / count);
  return Array.from({ length: count }, (_, index) =>
    groups.value.slice(index * size, (index + 1) * size),
  ).filter((column) => column.length > 0);
});
</script>

<template>
  <div class="profs">
    <div v-for="(column, colIndex) in columnGroups" :key="colIndex" class="profs__column">
      <p
        v-for="group in column"
        :key="group.label"
        class="profs__group"
        :data-group="group.label"
      >
        <span class="profs__label">{{ group.label }}:</span>
        <span class="profs__items">{{ group.items.join(', ') }}</span>
      </p>
    </div>
    <p v-if="groups.length === 0" class="profs__empty">None</p>
  </div>
</template>

<style scoped>
.profs {
  display: flex;
  align-items: stretch;
  gap: 16px;
  height: 100%;
}

.profs__column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  /* Spread the groups down the full card height so the wider layout doesn't
     leave empty space at the bottom; `gap` is the minimum spacing. */
  justify-content: space-between;
  gap: 6px;
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

.profs__empty {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
