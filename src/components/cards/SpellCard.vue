<script lang="ts" setup>
import { computed, inject } from 'vue';
import type { SpellEntry } from '@/services/dndbeyond/model';
import { spellSchoolStyle } from '@/utils/character/dnd5e';
import { formatDamage } from '@/utils/character/format';
import { ToggleSpellCardsKey } from '@/utils/layout/spell-cards';

const props = defineProps<{ spell: SpellEntry }>();

// Injected by App so any card can collapse the whole set back to the quick sheet.
const collapse = inject(ToggleSpellCardsKey, undefined);

const school = computed(() => spellSchoolStyle(props.spell.school));
const levelLabel = computed(() => (props.spell.level === 0 ? '0' : String(props.spell.level)));

/** Detail rows (label + value), dropping any the spell doesn't have. */
const rows = computed(() => {
  const spell = props.spell;
  const hit = spell.save ? `${spell.save} save` : spell.attack ? 'Spell attack' : '';
  const entries: [string, string | undefined][] = [
    ['Cast', spell.castingTime],
    ['Range', spell.range],
    ['Comp', spell.components],
    ['Dur', spell.duration],
    ['Hit', hit],
    ['Dmg', formatDamage(spell.damage)],
  ];
  return entries.filter((entry): entry is [string, string] => Boolean(entry[1]));
});
</script>

<template>
  <div class="spell-card" :style="{ '--school-color': school.color }" data-spell-card>
    <div class="spell-card__head">
      <span
        class="spell-card__level"
        :title="spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`"
      >
        {{ levelLabel }}
      </span>
      <span class="spell-card__school" :title="spell.school">{{ school.abbr }}</span>
    </div>
    <dl class="spell-card__rows">
      <div v-for="[label, value] in rows" :key="label" class="spell-card__row">
        <dt class="spell-card__key">{{ label }}</dt>
        <dd class="spell-card__value">{{ value }}</dd>
      </div>
    </dl>
    <button
      v-if="collapse"
      type="button"
      class="spell-card__collapse"
      title="Back to the spell list"
      aria-label="Back to the spell list"
      @click="collapse"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.spell-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* Periodic-table tile: a school-coloured top accent. */
  border-top: 3px solid var(--school-color);
  margin-top: -2px;
}

.spell-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 4px;
}

/* The spell level, top-left like an atomic number. */
.spell-card__level {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  color: var(--p-text-muted-color, #71717a);
}

/* The school symbol, top-right like an element symbol. */
.spell-card__school {
  padding: 2px 5px;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  background: var(--school-color);
  border-radius: 4px;
}

.spell-card__rows {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1px 6px;
  margin: 0;
  font-size: 12px;
}

.spell-card__row {
  display: contents;
}

.spell-card__key {
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.spell-card__value {
  margin: 0;
}

/* Collapse-to-quick-sheet control, pinned to the card's bottom-right. */
.spell-card__collapse {
  margin: auto 0 0 auto;
  padding: 2px;
  display: inline-flex;
  color: var(--p-text-muted-color, #a1a1aa);
  background: none;
  border: none;
  cursor: pointer;
}

.spell-card__collapse:hover {
  color: var(--school-color);
}

.spell-card__collapse svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

/* Print keeps the card but drops the interactive collapse control. */
@media print {
  .spell-card__collapse {
    display: none;
  }
}
</style>
