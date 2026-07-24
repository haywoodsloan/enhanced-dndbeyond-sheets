<script lang="ts" setup>
import { computed } from 'vue';
import type { SpellEntry } from '@/services/dndbeyond/model';
import { spellSchoolStyle } from '@/utils/character/dnd5e';
import { formatDamage } from '@/utils/character/format';
import InlineScalingText from '@/components/InlineScalingText.vue';
import RichText from '@/components/RichText.vue';

const props = withDefaults(
  defineProps<{ spell: SpellEntry; companionTitle?: string }>(),
  { companionTitle: 'Companions' },
);

const school = computed(() => spellSchoolStyle(props.spell.school));
const levelLabel = computed(() => (props.spell.level === 0 ? '0' : String(props.spell.level)));
const durationLabel = computed(() => {
  if (!props.spell.concentration) return props.spell.duration;
  return props.spell.duration
    ? `Concentration, ${props.spell.duration}`
    : 'Concentration';
});

/** Detail rows (label + value), dropping any the spell doesn't have. */
const rows = computed(() => {
  const spell = props.spell;
  const hit = spell.save ? `${spell.save} save` : spell.attack ? 'Spell attack' : '';
  const entries: [string, string | undefined][] = [
    ['Cast', spell.castingTime],
    ['Range', spell.range],
    ['Comp', spell.components],
    ['Material', spell.material],
    ['Dur', durationLabel.value],
    ['Hit', hit],
    ['Dmg', formatDamage(spell.damage)],
  ];
  return entries.filter((entry): entry is [string, string] => Boolean(entry[1]));
});
</script>

<template>
  <div class="spell-card" :style="{ '--school-color': school.color }" data-spell-card>
    <div class="spell-card__head" data-spell-card-part>
      <span
        class="spell-card__level"
        :title="spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`"
      >
        {{ levelLabel }}
      </span>
      <span class="spell-card__school" :title="spell.school">{{ school.abbr }}</span>
    </div>
    <dl class="spell-card__rows">
      <div
        v-for="[label, value] in rows"
        :key="label"
        class="spell-card__row"
        data-spell-card-part
      >
        <dt class="spell-card__key">{{ label }}</dt>
        <dd class="spell-card__value"><InlineScalingText :text="value" /></dd>
      </div>
    </dl>
    <span
      v-if="spell.related?.includes('companions')"
      class="spell-card__reference"
      data-spell-card-part
    >
      See {{ companionTitle }}
    </span>
    <RichText
      v-if="spell.summary"
      :text="spell.summary"
      class="spell-card__summary"
      data-spell-card-part
    />
    <RichText
      v-if="spell.upcast"
      :text="spell.upcast"
      class="spell-card__upcast"
      data-spell-card-part
    />
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
  overflow-wrap: anywhere;
}

.spell-card__reference,
.spell-card__summary,
.spell-card__upcast {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  line-height: 1.25;
  color: var(--p-text-muted-color, #888);
  overflow-wrap: anywhere;
}

.spell-card__reference {
  font-weight: 600;
}
</style>
