<script lang="ts" setup>
import { computed } from 'vue';
import type { SpellEntry, Spellcasting } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';

const props = defineProps<{ spells: SpellEntry[]; spellcasting?: Spellcasting }>();

const groups = computed(() => {
  const byLevel = new Map<number, string[]>();
  for (const spell of props.spells) {
    const names = byLevel.get(spell.level) ?? [];
    names.push(spell.name);
    byLevel.set(spell.level, names);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, names]) => ({
      level,
      label: level === 0 ? 'Cantrips' : `Level ${level}`,
      names,
    }));
});

/** Spell levels that actually have slots, paired with an ordinal label. */
const slotLevels = computed(() =>
  (props.spellcasting?.slots ?? [])
    .map((count, index) => ({ level: index + 1, count }))
    .filter((slot) => slot.count > 0),
);

function ordinal(n: number): string {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}
</script>

<template>
  <div class="spells">
    <div v-if="spellcasting" class="spells__casting" data-spellcasting>
      <span class="spells__stat">Atk <b>{{ formatModifier(spellcasting.attack) }}</b></span>
      <span class="spells__stat">Save <b>DC {{ spellcasting.saveDc }}</b></span>
      <span class="spells__stat">
        {{ spellcasting.ability }} <b>{{ formatModifier(spellcasting.modifier) }}</b>
      </span>
    </div>
    <div v-if="slotLevels.length" class="spells__slots" data-slots>
      <span v-for="slot in slotLevels" :key="slot.level" class="spells__slot">
        <span class="spells__slot-level">{{ ordinal(slot.level) }}</span>
        <ResourceBoxes :resource="{ max: slot.count }" />
      </span>
    </div>
    <div
      v-for="group in groups"
      :key="group.level"
      class="spells__group"
      :data-level="group.level"
    >
      <span class="spells__label">{{ group.label }}</span>
      <span class="spells__names">{{ group.names.join(', ') }}</span>
    </div>
  </div>
</template>

<style scoped>
.spells {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Spell attack / save DC / ability modifier summary. */
.spells__casting {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding-bottom: 4px;
  font-size: 13px;
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
}

.spells__stat {
  color: var(--p-text-muted-color, #888);
}

.spells__stat b {
  color: inherit;
  font-weight: 700;
}

/* One row of slot checkboxes per spell level. */
.spells__slots {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 14px;
}

.spells__slot {
  display: inline-flex;
  align-items: center;
}

.spells__slot-level {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.spells__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spells__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.spells__names {
  font-size: 14px;
}
</style>
