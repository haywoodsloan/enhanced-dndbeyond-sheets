<script lang="ts" setup>
import { computed } from 'vue';
import type { InventoryEntry } from '@/services/dndbeyond/model';

const props = defineProps<{ inventory: InventoryEntry[] }>();

// Split into three balanced columns so the wide card uses its full width; each
// column carries its own header so the circles stay labeled.
const columns = computed(() => {
  const size = Math.ceil(props.inventory.length / 3);
  return [
    props.inventory.slice(0, size),
    props.inventory.slice(size, size * 2),
    props.inventory.slice(size * 2),
  ].filter((column) => column.length > 0);
});
</script>

<template>
  <div class="inventory">
    <div v-for="(column, colIndex) in columns" :key="colIndex" class="column">
      <span class="column__spacer" aria-hidden="true"></span>
      <span class="column__label">Equipped</span>
      <span class="column__label">Attuned</span>
      <template v-for="(item, index) in column" :key="index">
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
  gap: 16px;
  align-items: flex-start;
}

.column {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr auto auto;
  column-gap: 8px;
  row-gap: 4px;
  align-content: start;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
