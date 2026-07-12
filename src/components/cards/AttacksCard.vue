<script lang="ts" setup>
import { computed } from 'vue';
import type { Attack } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';
import { formatDamage } from '@/utils/character/format';

const props = defineProps<{ attacks: Attack[] }>();

interface AttackRow {
  name: string;
  /** To-hit (e.g. "+4") or a save prompt (e.g. "DC 14 DEX"). */
  hit: string;
  /** Damage, range, and properties joined into one trailing detail line. */
  meta: string;
}

const rows = computed<AttackRow[]>(() =>
  props.attacks.map((attack) => ({
    name: attack.name,
    hit: attack.toHit != null ? formatModifier(attack.toHit) : (attack.save ?? ''),
    meta: [formatDamage(attack.damage), attack.range, attack.notes?.join(', ')]
      .filter(Boolean)
      .join(' · '),
  })),
);
</script>

<template>
  <ul class="attacks">
    <li v-for="(row, index) in rows" :key="index" class="attacks__item" data-attack>
      <span class="attacks__line">
        <span class="attacks__name">{{ row.name }}</span>
        <span v-if="row.hit" class="attacks__hit">{{ row.hit }}</span>
      </span>
      <span v-if="row.meta" class="attacks__meta">{{ row.meta }}</span>
    </li>
  </ul>
</template>

<style scoped>
/* Attacks flow into as many ~even columns as the card width allows (like the
   Actions card), so a few attacks fill the row instead of leaving a wide gap,
   and there are no fixed columns to misalign when the damage text runs long. */
.attacks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 4px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}

.attacks__item {
  position: relative;
  padding-left: 14px;
}

/* A disc marker matching the other list cards (the grid suppresses the native
   bullet, so draw one). */
.attacks__item::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 0.7em;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.attacks__line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.attacks__name {
  font-weight: 600;
}

.attacks__hit {
  font-variant-numeric: tabular-nums;
  color: var(--p-text-muted-color, #888);
}

/* Damage / range / properties trail on their own line, lighter and smaller. */
.attacks__meta {
  display: block;
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}
</style>
