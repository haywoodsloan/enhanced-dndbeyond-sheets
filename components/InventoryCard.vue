<script lang="ts" setup>
import type { InventoryEntry } from '@/services/dndbeyond/model';

defineProps<{ inventory: InventoryEntry[] }>();
</script>

<template>
  <ul class="items">
    <li
      v-for="(item, index) in inventory"
      :key="index"
      class="item"
      data-item
    >
      <span class="item__name">{{ item.name }}</span>
      <span v-if="item.quantity > 1" class="item__qty">×{{ item.quantity }}</span>
      <span v-if="item.equipped" class="item__tag">equipped</span>
      <span v-if="item.attuned" class="item__tag">attuned</span>
    </li>
  </ul>
</template>

<style scoped>
.items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 4px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
}

.item__name {
  flex: 1;
}

.item__qty {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}

.item__tag {
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 999px;
  color: var(--p-text-muted-color, #888);
}
</style>
