<script lang="ts" setup>
import { computed } from 'vue';
import type { Coins } from '@/services/dndbeyond/model';

const props = defineProps<{ wealth: Coins }>();

const coins = computed(() => [
  { key: 'pp', label: 'PP', value: props.wealth.pp },
  { key: 'gp', label: 'GP', value: props.wealth.gp },
  { key: 'ep', label: 'EP', value: props.wealth.ep },
  { key: 'sp', label: 'SP', value: props.wealth.sp },
  { key: 'cp', label: 'CP', value: props.wealth.cp },
]);
</script>

<template>
  <ul class="coins">
    <li v-for="coin in coins" :key="coin.key" class="coin" :data-coin="coin.key">
      <span class="coin__value">{{ coin.value }}</span>
      <span class="coin__label">{{ coin.label }}</span>
    </li>
  </ul>
</template>

<style scoped>
.coins {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.coin {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 6px;
}

.coin__value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.coin__label {
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
}
</style>
