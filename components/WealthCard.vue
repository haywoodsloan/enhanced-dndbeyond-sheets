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

// Everything converted to gold, so the sheet shows total worth at a glance.
const totalGp = computed(() => {
  const { pp, gp, ep, sp, cp } = props.wealth;
  const total = pp * 10 + gp + ep * 0.5 + sp * 0.1 + cp * 0.01;
  const rounded = Math.round(total * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
});
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
    <p class="wealth__total">
      <span class="wealth__total-label">Total</span>
      <span class="wealth__total-value">{{ totalGp }} gp</span>
    </p>
  </div>
</template>

<style scoped>
.wealth {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.coins {
  flex: 1;
  min-height: 0;
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
  gap: 10px;
}

/* Subtle rule between coin rows (matches the skills / inventory dividers). */
.coin + .coin {
  border-top: 1px solid var(--p-primary-200, #e5e7eb);
}

/* A little coin token, tinted to its metal (border + text only, no fill). */
.coin__disc {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
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

/* Running total, set off with a stronger rule as the summary line. */
.wealth__total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 4px 0 0;
  padding-top: 6px;
  border-top: 2px solid var(--p-primary-300, #d4d4d8);
}

.wealth__total-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-primary-700, #6b7280);
}

.wealth__total-value {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #1c1c1e;
}
</style>
