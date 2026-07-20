<script lang="ts" setup>
import { computed } from 'vue';
import type { Attack } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';
import { formatDamage } from '@/utils/character/format';

const props = defineProps<{ attacks: Attack[] }>();

// Weapon mastery properties (2024). Unlike ordinary properties (Finesse, Light,
// …), these can be used only with a feature such as Weapon Mastery, so they're
// flagged with a "*" wherever they appear and explained in a footnote below.
const MASTERY_PROPERTIES = new Set([
  'Cleave',
  'Graze',
  'Nick',
  'Push',
  'Sap',
  'Slow',
  'Topple',
  'Vex',
]);
const isMastery = (name: string) => MASTERY_PROPERTIES.has(name);

/** One weapon property shown beneath an attack; mastery ones are flagged. */
interface AttackNote {
  name: string;
  mastery: boolean;
}

interface AttackRow {
  name: string;
  /** To-hit (e.g. "+4") or a save prompt (e.g. "DC 14 DEX"). */
  hit: string;
  damage: string;
  range: string;
  /** Weapon properties (Finesse, Light, …), shown beneath the row. */
  notes: AttackNote[];
}

const rows = computed<AttackRow[]>(() =>
  props.attacks.map((attack) => ({
    name: attack.name,
    hit: attack.toHit != null ? formatModifier(attack.toHit) : (attack.save ?? ''),
    damage: formatDamage(attack.damage),
    range: attack.range ?? '',
    notes: (attack.properties ?? []).map((property) => ({
      name: property.name,
      mastery: isMastery(property.name),
    })),
  })),
);

// Only show the Properties column when at least one attack has properties, so an
// all-unarmed list stays a tidy four columns.
const hasNotes = computed(() => rows.value.some((row) => row.notes.length > 0));

// The distinct weapon properties in play (only those with a description), in
// first-seen order — defined in a legend at the foot of the card.
const legend = computed(() => {
  const seen = new Map<string, string>();
  for (const attack of props.attacks) {
    for (const property of attack.properties ?? []) {
      if (property.description && !seen.has(property.name)) {
        seen.set(property.name, property.description);
      }
    }
  }
  return [...seen].map(([name, description]) => ({
    name,
    description,
    mastery: isMastery(name),
  }));
});

// A mastery-property footnote is shown whenever any mastery property appears in
// the legend, explaining the "*" that marks them.
const hasMastery = computed(() => legend.value.some((entry) => entry.mastery));
</script>

<template>
  <div class="attacks-card">
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
        <span v-if="hasNotes" class="attacks__notes">
          <span
            v-for="(note, noteIndex) in row.notes"
            :key="noteIndex"
            class="attacks__note-item"
          >
            <span v-if="note.mastery" class="attacks__sr-only">Mastery property: </span>
            <span v-if="note.mastery" class="attacks__mastery-mark" aria-hidden="true">*</span>{{ note.name }}
          </span>
        </span>
      </div>
    </div>
    <dl v-if="legend.length" class="attacks__legend">
      <div v-for="entry in legend" :key="entry.name" class="attacks__legend-item">
        <dt>
          <span v-if="entry.mastery" class="attacks__sr-only">Mastery property: </span>
          <span v-if="entry.mastery" class="attacks__mastery-mark" aria-hidden="true">*</span>{{ entry.name }}
        </dt>
        <dd>{{ entry.description }}</dd>
      </div>
    </dl>
    <p v-if="hasMastery" class="attacks__mastery-note" data-mastery-note>
      <span class="attacks__mastery-mark" aria-hidden="true">*</span> To use a weapon's mastery property, you must
      have a feature, such as Weapon Mastery, that lets you use it.
    </p>
  </div>
</template>

<style scoped>
/* Stacks the attacks table and the properties legend beneath it. */
.attacks-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

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
  font-size: 12px;
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

/* Comma-separate the property names within the row's Properties cell. */
.attacks__note-item:not(:last-child)::after {
  content: ', ';
}

/* The "*" flagging a weapon-mastery property — set apart from the property name
   by weight and a hair of space, and keyed to the footnote below. */
.attacks__mastery-mark {
  margin-right: 2px;
  font-weight: 700;
  color: #1c1c1e;
}

.attacks__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* Legend at the foot of the card defining only the properties that appear in the
   list above. Each entry is a bold term followed by its rules text. */
.attacks__legend {
  margin: 0;
  padding-top: 6px;
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
  display: grid;
  gap: 6px;
  font-size: 13px;
  line-height: 1.35;
  color: var(--p-text-muted-color, #888);
}

.attacks__legend dt {
  display: inline;
  font-weight: 600;
  color: #1c1c1e;
}

.attacks__legend dt::after {
  content: ':';
}

.attacks__legend dd {
  display: inline;
  margin: 0 0 0 4px;
}

/* A note that the mastery properties above (Sap, Vex, …) can't be used without a
   Weapon Mastery feature. */
.attacks__mastery-note {
  margin: 0;
  padding-top: 6px;
  font-size: 13px;
  font-style: italic;
  line-height: 1.35;
  color: var(--p-text-muted-color, #888);
}
</style>
