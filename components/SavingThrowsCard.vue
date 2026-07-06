<script lang="ts" setup>
import type { SavingThrow } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/dnd5e';

withDefaults(defineProps<{ saves: SavingThrow[]; defences?: string[] }>(), {
  defences: () => [],
});
</script>

<template>
  <div class="saves-card">
    <ul class="saves">
      <li v-for="save in saves" :key="save.key" class="save" :data-save="save.key">
        <span
          class="save__prof"
          :class="{ 'save__prof--on': save.proficient }"
          :title="save.proficient ? 'Proficient' : 'Not proficient'"
        ></span>
        <span class="save__name" :title="save.name">{{ save.key.toUpperCase() }}</span>
        <span class="save__mod">{{ formatModifier(save.modifier) }}</span>
      </li>
    </ul>

    <div v-if="defences.length" class="defences" data-defences>
      <span class="defences__title">Defences</span>
      <ul class="defences__list">
        <li v-for="entry in defences" :key="entry" class="defences__item">
          {{ entry }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.saves-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: stretch;
}

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

.defences {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  border-left: 1px solid var(--p-primary-300, #d4d4d8);
  padding-left: 16px;
}

.defences__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.defences__list {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

.defences__item {
  font-size: 12px;
  line-height: 1.3;
}

.defences__item + .defences__item {
  margin-top: 4px;
}
</style>
