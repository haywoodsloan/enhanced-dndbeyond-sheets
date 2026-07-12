<script lang="ts" setup>
import { computed } from 'vue';
import type { Attack } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';

const props = defineProps<{ attacks: Attack[] }>();

interface AttackRow {
  name: string;
  /** To-hit (e.g. "+4") or a save prompt (e.g. "DC 14 DEX"). */
  hit: string;
  damage: string;
  range: string;
  notes: string;
}

/** "1d8+2 Piercing", "3 Bludgeoning", or "" when the attack deals no damage. */
function damageLabel(attack: Attack): string {
  const dmg = attack.damage;
  if (!dmg) return '';
  const base = dmg.dice
    ? `${dmg.dice}${dmg.bonus ? formatModifier(dmg.bonus) : ''}`
    : String(dmg.bonus ?? 0);
  return dmg.type ? `${base} ${dmg.type}` : base;
}

const rows = computed<AttackRow[]>(() =>
  props.attacks.map((attack) => ({
    name: attack.name,
    hit: attack.toHit != null ? formatModifier(attack.toHit) : (attack.save ?? ''),
    damage: damageLabel(attack),
    range: attack.range ?? '',
    notes: attack.notes?.join(', ') ?? '',
  })),
);
</script>

<template>
  <div class="attacks">
    <div class="attacks__head" aria-hidden="true">
      <span>Attack</span>
      <span class="attacks__hit">Hit/DC</span>
      <span>Damage</span>
      <span class="attacks__range">Range</span>
    </div>
    <div v-for="(row, index) in rows" :key="index" class="attacks__row" data-attack>
      <span class="attacks__name">{{ row.name }}</span>
      <span class="attacks__hit">{{ row.hit }}</span>
      <span class="attacks__damage">{{ row.damage }}</span>
      <span class="attacks__range">{{ row.range }}</span>
      <span v-if="row.notes" class="attacks__notes">{{ row.notes }}</span>
    </div>
  </div>
</template>

<style scoped>
.attacks {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}

/* Shared 4-column track: name grows, the stat columns hug their content. */
.attacks__head,
.attacks__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: baseline;
  column-gap: 12px;
}

.attacks__head {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color, #888);
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
  padding-bottom: 2px;
}

.attacks__row {
  padding: 1px 0;
}

/* Notes wrap onto their own line beneath the row, spanning all four columns. */
.attacks__notes {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}

.attacks__name {
  font-weight: 600;
}

.attacks__hit {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.attacks__range {
  text-align: right;
  white-space: nowrap;
  color: var(--p-text-muted-color, #888);
}

.attacks__damage {
  white-space: nowrap;
}
</style>
