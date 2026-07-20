<script lang="ts" setup>
import { computed } from 'vue';
import type { PactSlotPool, SpellEntry, Spellcasting } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';
import { formatDamage } from '@/utils/character/format';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';
import RichText from '@/components/RichText.vue';
import StructuredList from '@/components/StructuredList.vue';

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
  const pactSlots = props.spellcasting?.pactSlots ?? [];
  const maxLevel = Math.max(slots.length, 0, ...pactSlots.map((pool) => pool.level), ...byLevel.keys());
  const result: {
    level: number;
    label: string;
    spells: SpellEntry[];
    slots: number;
    pactSlots: PactSlotPool[];
  }[] = [];
  for (let level = 0; level <= maxLevel; level += 1) {
    const levelSpells = byLevel.get(level) ?? [];
    const levelSlots = level >= 1 ? (slots[level - 1] ?? 0) : 0;
    const levelPactSlots = pactSlots.filter((pool) => pool.level === level);
    if (levelSpells.length === 0 && levelSlots === 0 && levelPactSlots.length === 0) continue;
    result.push({
      level,
      label: level === 0 ? 'Cantrips' : `Level ${level}`,
      spells: levelSpells,
      slots: levelSlots,
      pactSlots: levelPactSlots,
    });
  }
  return result;
});

/** Compact per-spell shorthand: "A · 60 ft. · V,S · 1d8 Radiant · DEX save". */
function spellMeta(spell: SpellEntry): string {
  const hit = spell.save ? `${spell.save} save` : spell.attack ? 'Spell attack' : '';
  const ability = (props.spellcasting?.profiles.length ?? 0) > 1 ? spell.ability : '';
  return [ability, spell.castingTime, spell.range, spell.components, formatDamage(spell.damage), hit]
    .filter(Boolean)
    .join(' · ');
}

/** Concentration / ritual markers, each shown in its own box. */
function spellTags(spell: SpellEntry): { key: string; label: string; title: string }[] {
  const tags: { key: string; label: string; title: string }[] = [];
  if (spell.concentration) tags.push({ key: 'C', label: 'C', title: 'Concentration' });
  if (spell.ritual) tags.push({ key: 'R', label: 'R', title: 'Ritual' });
  return tags;
}
</script>

<template>
  <div class="spells">
    <div v-if="spellcasting" class="spells__casting" data-spellcasting>
      <span
        v-for="profile in spellcasting.profiles"
        :key="`${profile.source}-${profile.ability}`"
        class="spells__profile"
        data-spellcasting-profile
      >
        <b v-if="spellcasting.profiles.length > 1" class="spells__profile-source">
          {{ profile.source }}
        </b>
        <span class="spells__stat">Attack <b>{{ formatModifier(profile.attack) }}</b></span>
        <span class="spells__stat">Save <b>DC {{ profile.saveDc }}</b></span>
        <span class="spells__stat">
          {{ profile.ability }} <b>{{ formatModifier(profile.modifier) }}</b>
        </span>
      </span>
    </div>
    <div
      v-for="group in groups"
      :key="group.level"
      class="spells__group"
      :data-level="group.level"
      data-card-group
    >
      <div class="spells__group-head">
        <span class="spells__label">{{ group.label }}</span>
        <ResourceBoxes v-if="group.slots > 0" :resource="{ max: group.slots }" data-slots />
        <span
          v-for="pool in group.pactSlots"
          :key="pool.source"
          class="spells__pact"
          data-pact-slots
        >
          <span class="spells__pact-label">{{ pool.source }} Pact</span>
          <ResourceBoxes
            :resource="{
              max: pool.max,
              recovery: { kind: 'rest', rest: 'short' },
            }"
          />
        </span>
      </div>
      <ul v-if="group.spells.length" class="spells__list">
        <li
          v-for="(spell, index) in group.spells"
          :key="index"
          class="spells__spell"
          data-spell
        >
          <span class="spells__name">{{ spell.name }}</span>
          <span
            v-for="tag in spellTags(spell)"
            :key="tag.key"
            class="spells__spell-tag"
            :title="tag.title"
            >{{ tag.label }}</span
          >
          <span
            v-for="(use, useIndex) in spell.featureUses"
            :key="`${use.source}-${useIndex}`"
            class="spells__feature-use"
            data-spell-use
          >
            <span class="spells__feature-source">{{ use.source }}:</span>
            <ResourceBoxes :resource="use.pool" />
          </span>
          <span v-if="spellMeta(spell)" class="spells__meta">{{ spellMeta(spell) }}</span>
          <RichText v-if="spell.summary" :text="spell.summary" class="spells__summary" />
          <StructuredList
            v-if="spell.list?.items.length"
            :list="spell.list"
            :bullets="false"
            class="spells__structured-list"
            data-spell-list
          />
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
  color: var(--p-text-color, #1c1c1e);
  font-weight: 700;
}

.spells__profile {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.spells__profile-source {
  color: var(--p-text-color, #1c1c1e);
}

.spells__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* A divider line between spell levels. Drawn on the BOTTOM of each group (except
   the last) so a level continuing onto a “(cont.)” card leaves no stray rule atop
   the continuation (the base card clips it off). */
.spells__group:not(:last-child) {
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
  padding-bottom: 6px;
}

/* Level heading with its slot checkboxes at the start of the level. */
.spells__group-head {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Slightly larger spell-slot checkboxes to match the bigger level headings. */
.spells__group-head :deep(.resource__box) {
  width: 13px;
  height: 13px;
}

.spells__pact {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
}

.spells__pact-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.spells__pact :deep(.resource) {
  margin-left: 4px;
}

.spells__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.spells__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spells__spell {
  font-size: 14px;
  line-height: 1.35;
}

.spells__name {
  font-weight: 600;
  color: var(--p-text-color, #1c1c1e);
}

/* Concentration/ritual marker box after the spell name. */
.spells__spell-tag {
  margin-left: 4px;
  padding: 0 3px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color, #888);
  border: 1px solid var(--p-primary-200, #e4e4e7);
  border-radius: 3px;
}

/* A feature's own casts are distinct from spell slots and name their source. */
.spells__feature-use {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  white-space: nowrap;
}

.spells__feature-source {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.spells__feature-use :deep(.resource) {
  margin-left: 4px;
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

.spells__structured-list {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--p-text-muted-color, #888);
}

.spells__structured-list :deep(.structured-list__label),
.spells__structured-list :deep(.structured-list__item strong) {
  color: var(--p-text-color, #1c1c1e);
}
</style>
