<script lang="ts" setup>
import { computed } from 'vue';
import type { ResourcePool } from '@/services/dndbeyond/model';

const props = defineProps<{ resource: ResourcePool }>();

const recovery = computed(() => {
  const rule = props.resource.recovery;
  if (rule?.kind === 'rest') return rule.rest === 'short' ? 'short rest' : 'Long rest';
  if (rule?.kind === 'partial-short-full-long') {
    return `${rule.shortRestUses}/short rest, all/long rest`;
  }
  return rechargeLabel(props.resource.recharge ?? '');
});

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
    <span v-if="recovery" class="resource__recharge">{{ recovery }}</span>
    <span
      v-for="(option, index) in resource.alternateRecovery"
      :key="index"
      class="resource__alternate"
      :title="option.restores === 'all' ? 'Restores all uses' : `Restores ${option.restores} ${option.restores === 1 ? 'use' : 'uses'}`"
      data-alternate-recovery
    >or spend {{ option.cost }}{{ option.restores === 1 ? '' : ` to restore ${option.restores}` }}</span>
  </span>
</template>

<style scoped>
/* A row of empty squares meant to be ticked by hand on the printed sheet, with
   an optional recharge tag ("short rest" / "Long rest"). */
.resource {
  display: inline-flex;
  flex-wrap: wrap;
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
  flex-shrink: 0;
}

.resource__recharge,
.resource__alternate {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--p-text-muted-color, #888);
}
</style>
