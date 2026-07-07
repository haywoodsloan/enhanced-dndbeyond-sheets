<script lang="ts" setup>
import { computed } from 'vue';
import type { AbilityScore } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/dnd5e';

const props = defineProps<{ abilities: AbilityScore[]; rows?: number }>();

// Arrange the tiles in `rows` rows (from the chosen layout) and stretch them to
// fill the card: columns = ceil(count / rows), every track 1fr.
const gridStyle = computed(() => {
  const rows = Math.max(1, props.rows ?? 2);
  const cols = Math.max(1, Math.ceil(props.abilities.length / rows));
  return {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  };
});
</script>

<template>
  <ul class="abilities" :style="gridStyle">
    <li
      v-for="ability in abilities"
      :key="ability.key"
      class="ability"
      :data-ability="ability.key"
    >
      <span class="ability__name">{{ ability.name }}</span>
      <span class="ability__mod">{{ formatModifier(ability.modifier) }}</span>
      <span class="ability__score">{{ ability.score }}</span>
    </li>
  </ul>
</template>

<style scoped>
.abilities {
  display: grid;
  gap: 8px;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 4px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 8px;
}

.ability__name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--p-text-muted-color, #888);
}

.ability__mod {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.ability__score {
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
