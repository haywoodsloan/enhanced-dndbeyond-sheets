<script lang="ts" setup>
import { computed } from 'vue';
import type { SpellEntry, Spellcasting } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';
import { formatDamage } from '@/utils/character/format';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';

const props = defineProps<{ spells: SpellEntry[]; spellcasting?: Spellcasting }>();

const groups = computed(() => {
  const byLevel = new Map<number, SpellEntry[]>();
  for (const spell of props.spells) {
    const list = byLevel.get(spell.level) ?? [];
    list.push(spell);
    byLevel.set(spell.level, list);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, spells]) => ({
      level,
      label: level === 0 ? 'Cantrips' : `Level ${level}`,
      spells,
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

/** Compact per-spell shorthand: "A · 60 ft. · V,S · 1d8 Radiant · DEX save". */
function spellMeta(spell: SpellEntry): string {
  const hit = spell.save ? `${spell.save} save` : spell.attack ? 'Spell atk' : '';
  return [spell.castingTime, spell.range, spell.components, formatDamage(spell.damage), hit]
    .filter(Boolean)
    .join(' · ');
}

/** Concentration / ritual tags for a spell. */
function spellTags(spell: SpellEntry): string {
  return `${spell.concentration ? 'C' : ''}${spell.ritual ? 'R' : ''}`;
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
      <ul class="spells__list">
        <li
          v-for="(spell, index) in group.spells"
          :key="index"
          class="spells__spell"
          data-spell
        >
          <span class="spells__name">{{ spell.name }}</span>
          <span v-if="spellTags(spell)" class="spells__spell-tags">{{ spellTags(spell) }}</span>
          <span v-if="spellMeta(spell)" class="spells__meta">{{ spellMeta(spell) }}</span>
        </li>
      </ul>
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

.spells__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.spells__spell {
  font-size: 14px;
  line-height: 1.35;
}

.spells__name {
  font-weight: 600;
}

/* Concentration/ritual tag pill after the spell name. */
.spells__spell-tags {
  margin-left: 4px;
  padding: 0 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color, #888);
  border: 1px solid var(--p-primary-200, #e4e4e7);
  border-radius: 3px;
}

.spells__meta {
  margin-left: 6px;
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}
</style>
