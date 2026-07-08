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
  <div class="wealth">
    <ul class="coins">
      <li v-for="coin in coins" :key="coin.key" class="coin" :data-coin="coin.key">
        <span class="coin__disc" :class="`coin__disc--${coin.key}`" aria-hidden="true">{{
          coin.label
        }}</span>
        <span class="coin__name">{{ coin.name }}</span>
        <span class="coin__value">{{ coin.value }}</span>
      </li>
    </ul>
    <div class="wealth__gains">
      <span class="wealth__gains-label">Gained since printing</span>
    </div>
  </div>
</template>

<style scoped>
.wealth {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.coins {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.coin {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* A little coin token, tinted to its metal (border + text only, no fill). */
.coin__disc {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--p-primary-300, #d4d4d8);
  border-radius: 50%;
  font-size: 10px;
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

/* Blank space for the player to jot coins gained since the sheet was printed. */
.wealth__gains {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  padding-top: 6px;
  border-top: 1px solid var(--p-primary-200, #e5e7eb);
}

.wealth__gains-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}
</style>
