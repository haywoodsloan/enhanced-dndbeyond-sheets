<script lang="ts" setup>
import type { SavingThrow } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/dnd5e';

defineProps<{ saves: SavingThrow[] }>();
</script>

<template>
  <ul class="saves">
    <li v-for="save in saves" :key="save.key" class="save" :data-save="save.key">
      <span
        class="save__prof"
        :class="{ 'save__prof--on': save.proficient }"
        :title="save.proficient ? 'Proficient' : 'Not proficient'"
      ></span>
      <span class="save__name">{{ save.name }}</span>
      <span class="save__mod">{{ formatModifier(save.modifier) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.saves {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.save {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.save__prof {
  flex: none;
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--p-text-muted-color, #888);
  border-radius: 50%;
}

.save__prof--on {
  background: var(--p-primary-color, #1c1c1e);
  border-color: var(--p-primary-color, #1c1c1e);
}

.save__name {
  flex: 1;
}

.save__mod {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
