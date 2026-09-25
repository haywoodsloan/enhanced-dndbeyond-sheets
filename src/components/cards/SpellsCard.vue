<script lang="ts" setup>
import { computed } from 'vue';
import type { PactSlotPool, SpellEntry, Spellcasting } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';
import { formatDamage } from '@/utils/character/format';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';
import RichText from '@/components/RichText.vue';
import SpellUses from '@/components/cards/SpellUses.vue';
import SpellDetails from '@/components/cards/SpellDetails.vue';

const props = defineProps<{
  spells: SpellEntry[];
  spellcasting?: Spellcasting;
  companionTitle?: string;
  summaryOnly?: boolean;
}>();

const profiles = computed(() => {
  const casting = props.spellcasting;
  if (!casting) return [];
  return casting.profiles?.length ? casting.profiles : [{ source: '', ...casting }];
});

/**
 * Spell levels to show: every level with spells or slots. Each carries its spell
 * list and its slot count, so the slot checkboxes sit at the START of their
 * level rather than all bunched at the top.
 */
const groups = computed(() => {
  const byLevel = new Map<number, SpellEntry[]>();
  for (const spell of props.summaryOnly ? [] : props.spells) {
    const list = byLevel.get(spell.level) ?? [];
    list.push(spell);
    byLevel.set(spell.level, list);
  }
  const slots = props.spellcasting?.slots ?? [];
  const pactSlots = props.spellcasting?.pactSlots ?? [];
  const maxLevel = Math.max(slots.length, 0, ...pactSlots.map((pool) => pool.level), ...byLevel.keys());
  const result: {
    level: number; label: string; spells: SpellEntry[]; slots: number; pactSlots: PactSlotPool[];
  }[] = [];
  for (let level = 0; level <= maxLevel; level += 1) {
    const levelSpells = byLevel.get(level) ?? [];
    const levelSlots = level >= 1 ? (slots[level - 1] ?? 0) : 0;
    const levelPactSlots = pactSlots.filter((pool) => pool.level === level && pool.max > 0);
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
  const ability = spell.castingSources?.length ? undefined : spell.ability;
  return [ability, spell.castingTime, spell.range, spell.components, spell.duration, formatDamage(spell.damage), hit]
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
      <div
        v-for="(profile, index) in profiles"
        :key="`${profile.source}-${profile.ability}-${index}`"
        class="spells__profile"
        data-spellcasting-profile
        data-spell-card-part
      >
        <strong v-if="profile.source">{{ profile.source }}</strong>
        <span class="spells__stat">Spell attack <b>{{ formatModifier(profile.attack) }}</b></span>
        <span class="spells__stat">Save <b>DC {{ profile.saveDc }}</b></span>
        <span class="spells__stat">
          Modifier ({{ profile.ability }}) <b>{{ formatModifier(profile.modifier) }}</b>
        </span>
        <span v-if="'focus' in profile && profile.focus" class="spells__stat">Focus <b>{{ profile.focus }}</b></span>
      </div>
    </div>
    <div
      v-for="group in groups"
      :key="group.level"
      class="spells__group"
      :data-level="group.level"
      data-card-group
    >
      <div class="spells__group-head" data-spell-level>
        <span class="spells__label">{{ group.label }}</span>
        <ResourceBoxes v-if="group.slots > 0" :resource="{ max: group.slots }" data-slots />
        <span
          v-for="(pool, index) in group.pactSlots"
          :key="`${pool.source}-${index}`"
          class="spells__pact"
          data-pact-slots
        >
          {{ pool.source }} Pact Magic
          <ResourceBoxes :resource="{ max: pool.max, recovery: { kind: 'rest', rest: 'short' } }" />
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
          <SpellUses :spell="spell" />
          <span v-if="spellMeta(spell)" class="spells__meta">{{ spellMeta(spell) }}</span>
          <RichText v-if="spell.summary" :text="spell.summary" class="spells__summary" />
          <SpellDetails :spell="spell" :spellcasting="spellcasting" :companion-title="companionTitle" />
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
  flex-direction: column;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding-bottom: 4px;
  font-size: 13px;
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
}

.spells__profile,
.spells__pact {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
}

.spells__pact {
  font-size: 12px;
  gap: 4px;
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
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

/* Slightly larger spell-slot checkboxes to match the bigger level headings. */
.spells__group-head :deep(.resource__box) {
  width: 13px;
  height: 13px;
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
