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
  damage: string;
  range: string;
  /** Weapon properties (e.g. "Finesse, Light"), shown beneath the row. */
  notes: string;
}

const rows = computed<AttackRow[]>(() =>
  props.attacks.map((attack) => ({
    name: attack.name,
    hit: attack.toHit != null ? formatModifier(attack.toHit) : (attack.save ?? ''),
    damage: formatDamage(attack.damage),
    range: attack.range ?? '',
    notes: attack.notes?.join(', ') ?? '',
  })),
);

// Only show the Properties column when at least one attack has properties, so an
// all-unarmed list stays a tidy four columns.
const hasNotes = computed(() => rows.value.some((row) => row.notes));
</script>

<template>
  <div class="attacks" :class="{ 'attacks--props': hasNotes }">
    <div class="attacks__head" aria-hidden="true">
      <span>Attack</span>
      <span class="attacks__hit">Hit/DC</span>
      <span>Damage</span>
      <span>Range</span>
      <span v-if="hasNotes">Properties</span>
    </div>
    <div v-for="(row, index) in rows" :key="index" class="attacks__row" data-attack>
      <span class="attacks__name">{{ row.name }}</span>
      <span class="attacks__hit">{{ row.hit }}</span>
      <span class="attacks__damage">{{ row.damage }}</span>
      <span class="attacks__range">{{ row.range }}</span>
      <span v-if="hasNotes" class="attacks__notes">{{ row.notes }}</span>
    </div>
  </div>
</template>

<style scoped>
/* One shared grid for the header and every row (via `subgrid`), so the column
   headings line up with the data even when a cell's text wraps, and the columns
   spread proportionally across the full card width instead of leaving a wide gap
   after the name. A fifth Properties column is added when any weapon has one. */
.attacks {
  display: grid;
  grid-template-columns:
    minmax(0, 2fr) minmax(0, 0.9fr) minmax(0, 1.7fr) minmax(0, 1fr);
  row-gap: 3px;
  column-gap: 12px;
  font-size: 14px;
}

/* Weapon properties get their own column when present; otherwise the table stays
   four columns and doesn't reserve empty space for them. */
.attacks--props {
  grid-template-columns:
    minmax(0, 1.7fr) minmax(0, 0.8fr) minmax(0, 1.5fr) minmax(0, 0.9fr) minmax(0, 1.6fr);
}

.attacks__head,
.attacks__row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: baseline;
}

.attacks__head {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color, #888);
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
  padding-bottom: 3px;
}

.attacks__name {
  font-weight: 600;
}

.attacks__hit {
  font-variant-numeric: tabular-nums;
}

.attacks__range {
  white-space: nowrap;
  color: var(--p-text-muted-color, #888);
}

/* Weapon properties (Finesse, Light, …) read as secondary to the core stats:
   lighter, smaller, and wrapping within their own column. */
.attacks__notes {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}
</style>
