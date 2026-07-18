<script lang="ts" setup>
import type { SenseEntry } from '@/services/dndbeyond/model';

withDefaults(defineProps<{ senses?: SenseEntry[] }>(), {
  senses: () => [],
});
</script>

<template>
  <dl v-if="senses.length" class="senses" data-senses>
    <div v-for="entry in senses" :key="entry.label" class="senses__item" data-sense>
      <dt class="senses__label">{{ entry.label }}</dt>
      <dd class="senses__value">{{ entry.value }}</dd>
    </div>
  </dl>
  <p v-else class="senses__empty">No special senses.</p>
</template>

<style scoped>
.senses {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0;
}

/* Equal-height bands spread the senses down the full card height (matching the
   Abilities / Wealth fill), so a taller footprint doesn't leave a gap below. */
.senses__item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.senses__item + .senses__item {
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
}

.senses__label {
  margin: 0;
  font-size: 13px;
  line-height: 1.3;
  color: #1c1c1e;
}

.senses__value {
  flex: none;
  margin: 0;
  min-width: 34px;
  padding: 2px 10px;
  border: 1px solid var(--p-primary-200, #e4e4e7);
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  color: #1c1c1e;
}

.senses__empty {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
