<script lang="ts" setup>
import type { ResourcePool } from '@/services/dndbeyond/model';

defineProps<{ resource: ResourcePool }>();

/** Spell out the recharge shorthand for the printed tag. */
function rechargeLabel(recharge: string): string {
  if (recharge === 'SR') return 'short rest';
  if (recharge === 'LR') return 'Long rest';
  if (recharge === 'SR1_LR') return '1/short rest, all/long rest';
  return recharge;
}
</script>

<template>
  <span class="resource" data-resource>
    <span
      v-for="box in resource.max"
      :key="box"
      class="resource__box"
      aria-hidden="true"
    ></span>
    <span v-if="resource.recharge" class="resource__recharge">{{
      rechargeLabel(resource.recharge)
    }}</span>
  </span>
</template>

<style scoped>
/* A row of empty squares meant to be ticked by hand on the printed sheet, with
   an optional recharge tag ("short rest" / "Long rest"). */
.resource {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 6px;
  vertical-align: middle;
}

.resource__box {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--p-primary-400, #9ca3af);
  border-radius: 2px;
  box-sizing: border-box;
}

.resource__recharge {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--p-text-muted-color, #888);
}
</style>
