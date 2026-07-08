<script lang="ts" setup>
import { computed } from 'vue';
import type { AbilityScore } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/dnd5e';

const props = defineProps<{ abilities: AbilityScore[]; cols?: number; rows?: number }>();

// Arrange the tiles to stay roughly square for the card's aspect and stretch to
// fill. A single-grid-column card lays them out as ONE full-width column (a
// horizontal stat line each) so the narrow card fills instead of splitting into
// cramped mini-columns.
const grid = computed(() => {
  const cols = Math.max(1, props.cols ?? 2);
  const rows = Math.max(1, props.rows ?? 2);
  const count = props.abilities.length;
  const tileCols =
    cols <= 1
      ? 1
      : Math.min(count, Math.max(1, Math.round(Math.sqrt((count * cols) / rows))));
  return { tileCols, tileRows: Math.ceil(count / tileCols) };
});

const gridStyle = computed(() => ({
  // `minmax(0, 1fr)` (not `1fr`) so a wide row can't push its track past the
  // card edge — the cell caps at its share and the content fits inside instead.
  gridTemplateColumns: `repeat(${grid.value.tileCols}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${grid.value.tileRows}, minmax(0, 1fr))`,
}));

const isList = computed(() => grid.value.tileCols === 1);
</script>

<template>
  <ul class="abilities" :class="{ 'abilities--list': isList }" :style="gridStyle">
    <li
      v-for="ability in abilities"
      :key="ability.key"
      class="ability"
      :data-ability="ability.key"
    >
      <span class="ability__name">{{ ability.name }}</span>
      <span class="ability__mod">{{ formatModifier(ability.modifier) }}</span>
      <span class="ability__sep" aria-hidden="true">|</span>
      <span class="ability__score">{{ ability.score }}</span>
    </li>
  </ul>
</template>

<style scoped>
.abilities {
  display: grid;
  gap: 8px;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 4px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 8px;
}

/* Single-column (narrow) layout: full-width rows with the name on the left and
   the modifier + score on the right, so a tall narrow card fills cleanly. */
.abilities--list .ability {
  flex-direction: row;
  gap: 8px;
  padding: 6px 10px;
}

.abilities--list .ability__name {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The narrow list rows have room for slightly larger stat text; fixed widths +
   right alignment line the modifier and score up as columns down the rows. */
.abilities--list .ability__mod {
  min-width: 1.6em;
  font-size: 22px;
  text-align: right;
}

.abilities--list .ability__score {
  min-width: 1.4em;
  font-size: 16px;
  text-align: right;
}

/* A divider between the modifier and the total score, only in the list layout. */
.ability__sep {
  display: none;
}

.abilities--list .ability__sep {
  display: inline;
  font-size: 20px;
  font-weight: 300;
  color: var(--p-primary-300, #cbd5e1);
}

.ability__name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--p-text-muted-color, #888);
}

.ability__mod {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.ability__score {
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
