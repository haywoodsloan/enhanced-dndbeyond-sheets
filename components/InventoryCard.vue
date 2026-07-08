<script lang="ts" setup>
import { computed } from 'vue';
import type { InventoryEntry } from '@/services/dndbeyond/model';

const props = defineProps<{ inventory: InventoryEntry[]; columns?: number }>();

// Split into N balanced columns (from the chosen layout) so each footprint uses
// its full width; every column carries its own header so the circles stay
// labeled. Empty trailing columns are dropped.
const columnGroups = computed(() => {
  const count = Math.max(1, props.columns ?? 3);
  const size = Math.ceil(props.inventory.length / count);
  return Array.from({ length: count }, (_, index) =>
    props.inventory.slice(index * size, (index + 1) * size),
  ).filter((column) => column.length > 0);
});
</script>

<template>
  <div class="inventory">
    <div v-for="(column, colIndex) in columnGroups" :key="colIndex" class="column">
      <span class="column__spacer" aria-hidden="true"></span>
      <span class="column__label">Equipped</span>
      <span class="column__label">Attuned</span>
      <template v-for="(item, index) in column" :key="index">
        <span v-if="index > 0" class="item__divider" aria-hidden="true"></span>
        <span class="item__name" data-item>
          {{ item.name }}
          <span v-if="item.quantity > 1" class="item__qty">×{{ item.quantity }}</span>
        </span>
        <span
          class="item__dot"
          :class="{ 'item__dot--on': item.equipped }"
          :title="item.equipped ? 'Equipped' : 'Not equipped'"
        ></span>
        <span
          class="item__dot"
          :class="{ 'item__dot--on': item.attuned }"
          :title="item.attuned ? 'Attuned' : 'Not attuned'"
        ></span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.inventory {
  display: flex;
  align-items: stretch;
}

.column {
  flex: 1;
  min-width: 0;
  padding: 0 14px;
  display: grid;
  grid-template-columns: 1fr auto auto;
  column-gap: 8px;
  row-gap: 3px;
  align-content: start;
}

.column:first-child {
  padding-left: 0;
}

.column:last-child {
  padding-right: 0;
}

/* A thin divider between columns so the three lists are easy to scan. */
.column + .column {
  border-left: 1px solid var(--p-primary-200, #d4d4d8);
}

.column__label {
  justify-self: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
  white-space: nowrap;
}

.item__name {
  min-width: 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}

/* Subtle full-width rule between item rows (items carry no bullet marker). */
.item__divider {
  grid-column: 1 / -1;
  height: 1px;
  background: var(--p-primary-200, #e5e7eb);
}

.item__qty {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}

.item__dot {
  align-self: center;
  justify-self: center;
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--p-text-muted-color, #888);
  border-radius: 50%;
}

.item__dot--on {
  background: var(--p-primary-color, #1c1c1e);
  border-color: var(--p-primary-color, #1c1c1e);
}
</style>
