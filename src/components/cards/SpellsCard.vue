<script lang="ts" setup>
import { computed } from 'vue';
import type { SpellEntry, Spellcasting } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';
import { formatDamage } from '@/utils/character/format';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';

const props = defineProps<{ spells: SpellEntry[]; spellcasting?: Spellcasting }>();

/**
 * Spell levels to show: every level with spells or slots. Each carries its spell
 * list and its slot count, so the slot checkboxes sit at the START of their
 * level rather than all bunched at the top.
 */
const groups = computed(() => {
  const byLevel = new Map<number, SpellEntry[]>();
  for (const spell of props.spells) {
    const list = byLevel.get(spell.level) ?? [];
    list.push(spell);
    byLevel.set(spell.level, list);
  }
  const slots = props.spellcasting?.slots ?? [];
  const maxLevel = Math.max(slots.length, 0, ...byLevel.keys());
  const result: { level: number; label: string; spells: SpellEntry[]; slots: number }[] = [];
  for (let level = 0; level <= maxLevel; level += 1) {
    const levelSpells = byLevel.get(level) ?? [];
    const levelSlots = level >= 1 ? (slots[level - 1] ?? 0) : 0;
    if (levelSpells.length === 0 && levelSlots === 0) continue;
    result.push({
      level,
      label: level === 0 ? 'Cantrips' : `Level ${level}`,
      spells: levelSpells,
      slots: levelSlots,
    });
  }
  return result;
});

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
    <div
      v-for="group in groups"
      :key="group.level"
      class="spells__group"
      :data-level="group.level"
    >
      <div class="spells__group-head">
        <span class="spells__label">{{ group.label }}</span>
        <ResourceBoxes v-if="group.slots > 0" :resource="{ max: group.slots }" data-slots />
      </div>
      <ul v-if="group.spells.length" class="spells__list">
        <li
          v-for="(spell, index) in group.spells"
          :key="index"
          class="spells__spell"
          data-spell
        >
          <span class="spells__name">{{ spell.name }}</span>
          <span v-if="spellTags(spell)" class="spells__spell-tags">{{ spellTags(spell) }}</span>
          <span v-if="spellMeta(spell)" class="spells__meta">{{ spellMeta(spell) }}</span>
          <span v-if="spell.summary" class="spells__summary">{{ spell.summary }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.spells {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.spells__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Level heading with its slot checkboxes at the start of the level. */
.spells__group-head {
  display: flex;
  align-items: center;
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

/* One-line blurb of the spell's effect, on its own line beneath the shorthand. */
.spells__summary {
  display: block;
  font-size: 12px;
  line-height: 1.3;
  color: var(--p-text-muted-color, #888);
}
</style>
