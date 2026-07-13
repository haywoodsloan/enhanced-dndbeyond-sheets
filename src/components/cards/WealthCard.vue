<script lang="ts" setup>
import { computed } from 'vue';
import type { Coins } from '@/services/dndbeyond/model';

const props = defineProps<{ wealth: Coins }>();

const coins = computed(() => [
  { key: 'pp', label: 'PP', name: 'Platinum', value: props.wealth.pp },
  { key: 'gp', label: 'GP', name: 'Gold', value: props.wealth.gp },
  { key: 'ep', label: 'EP', name: 'Electrum', value: props.wealth.ep },
  { key: 'sp', label: 'SP', name: 'Silver', value: props.wealth.sp },
  { key: 'cp', label: 'CP', name: 'Copper', value: props.wealth.cp },
]);
</script>

<template>
  <ul class="coins">
    <li v-for="coin in coins" :key="coin.key" class="coin" :data-coin="coin.key">
      <span class="coin__disc" :class="`coin__disc--${coin.key}`" aria-hidden="true">{{
        coin.label
      }}</span>
      <span class="coin__name">{{ coin.name }}</span>
      <span class="coin__value">{{ coin.value }}</span>
      <span class="coin__add-sep" aria-hidden="true">+</span>
      <span class="coin__add" aria-hidden="true"></span>
    </li>
  </ul>
</template>

<style scoped>
.coins {
  height: 100%;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Even bands so the five denominations fill the card height. */
.coin {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* A little coin token, tinted to its metal (border + text only, no fill). */
.coin__disc {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--p-primary-300, #d4d4d8);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}

.coin__disc--pp {
  border-color: #6b7680;
  color: #6b7680;
}

.coin__disc--gp {
  border-color: #b08d1a;
  color: #b08d1a;
}

.coin__disc--ep {
  border-color: #9a8f4a;
  color: #9a8f4a;
}

.coin__disc--sp {
  border-color: #7f858b;
  color: #7f858b;
}

.coin__disc--cp {
  border-color: #a5623a;
  color: #a5623a;
}

.coin__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #1c1c1e;
}

.coin__value {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #1c1c1e;
}

/* "+ ___" — a per-coin blank for the player to add coins gained since printing. */
.coin__add-sep {
  color: var(--p-text-muted-color, #888);
}

.coin__add {
  flex: none;
  align-self: center;
  width: 2.4em;
  height: 1.1em;
  border-bottom: 1.5px solid var(--p-text-muted-color, #888);
}
</style>
