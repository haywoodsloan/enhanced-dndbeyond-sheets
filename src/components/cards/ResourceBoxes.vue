<script lang="ts" setup>
import type {
  AlternateRecovery,
  ResourcePool,
  ResourceRecovery,
} from '@/services/dndbeyond/model';

const props = defineProps<{ resource: ResourcePool }>();

/** Beyond this count, individual print boxes become wider than the feature or
 * action line. Point pools are clearer as one remaining/max write-in counter. */
const MAX_PRINT_BOXES = 8;

/** Spell out structured recovery rules for the printed tag. */
function recoveryLabel(recovery: ResourceRecovery): string {
  if (recovery.kind === 'rest') {
    return recovery.rest === 'short' ? 'short rest' : 'Long rest';
  }
  return `${recovery.shortRestUses}/short rest, all/long rest`;
}

function alternateLabel(option: AlternateRecovery): string {
  const restored = option.restores === 1 ? '' : ` to restore ${option.restores}`;
  return `or spend ${option.cost}${restored}`;
}

function alternateTitle(option: AlternateRecovery): string {
  if (option.restores === 'all') return 'Restores all uses';
  return `Restores ${option.restores} ${option.restores === 1 ? 'use' : 'uses'}`;
}
</script>

<template>
  <span class="resource" data-resource>
    <span
      v-for="box in props.resource.max <= MAX_PRINT_BOXES ? props.resource.max : 0"
      :key="box"
      class="resource__box"
      aria-hidden="true"
    ></span>
    <span
      v-if="props.resource.max > MAX_PRINT_BOXES"
      class="resource__counter"
      :aria-label="`Uses remaining out of ${props.resource.max}`"
      data-resource-counter
    >
      <span class="resource__counter-blank" aria-hidden="true"></span>
      <span aria-hidden="true">/{{ props.resource.max }}</span>
    </span>
    <span v-if="props.resource.recovery" class="resource__recharge">{{
      recoveryLabel(props.resource.recovery)
    }}</span>
    <span
      v-for="(option, index) in props.resource.alternateRecovery"
      :key="`${option.cost}-${index}`"
      class="resource__alternate"
      :title="alternateTitle(option)"
      data-alternate-recovery
    >
      {{ alternateLabel(option) }}
    </span>
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
}

.resource__counter {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.resource__counter-blank {
  width: 24px;
  border-bottom: 1px solid currentColor;
}

.resource__recharge {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--p-text-muted-color, #888);
}

.resource__alternate {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
  white-space: nowrap;
}
</style>
