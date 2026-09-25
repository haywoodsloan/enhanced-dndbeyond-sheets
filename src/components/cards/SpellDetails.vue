<script lang="ts" setup>
import { computed } from 'vue';
import type { SpellEntry, Spellcasting } from '@/services/dndbeyond/model';
import { sectionLabel } from '@/utils/character/section-label';
import { formatModifier } from '@/utils/character/dnd5e';
import RichText from '@/components/RichText.vue';
import StructuredList from '@/components/StructuredList.vue';

const props = withDefaults(
  defineProps<{
    spell: SpellEntry;
    spellcasting?: Spellcasting;
    companionTitle?: string;
    cardParts?: boolean;
  }>(),
  { companionTitle: 'Companions' },
);

const multipleProfiles = computed(() => (props.spellcasting?.profiles?.length ?? 0) > 1);
const matchingProfiles = computed(() => {
  if (props.spell.castingSources?.length) return props.spell.castingSources;
  const ability = props.spell.ability?.trim().toUpperCase();
  if (!ability) return [];
  return (props.spellcasting?.profiles ?? []).filter(
    (profile) => profile.ability.trim().toUpperCase() === ability,
  );
});
</script>

<template>
  <div
    v-if="spell.castingSources?.length || multipleProfiles"
    class="spell-detail"
    data-spell-casting
    :data-spell-card-part="cardParts ? '' : undefined"
  >
    <strong v-if="matchingProfiles.length > 1">By casting source:</strong>
    <div v-for="(profile, index) in matchingProfiles" :key="`${profile.source}-${index}`">
      <strong>{{ profile.source }} ({{ profile.ability }})</strong>
      · Spell attack {{ formatModifier(profile.attack) }} · Save DC {{ profile.saveDc }}
      <span v-if="profile.focus"> · Focus {{ profile.focus }}</span>
    </div>
    <span v-if="!matchingProfiles.length">
      {{ spell.ability ? `${spell.ability}: source-specific casting` : 'Casting source not specified' }}
    </span>
  </div>
  <div v-if="spell.material" class="spell-detail" :data-spell-card-part="cardParts ? '' : undefined">
    <strong>Materials:</strong> <RichText :text="spell.material" />
  </div>
  <StructuredList
    v-if="spell.list?.items.length"
    :list="spell.list"
    class="spell-detail"
    :data-spell-card-part="cardParts ? '' : undefined"
  />
  <div v-if="spell.upcast" class="spell-detail" :data-spell-card-part="cardParts ? '' : undefined">
    <strong>At Higher Levels:</strong> <RichText :text="spell.upcast" />
  </div>
  <span
    v-for="related in spell.related"
    :key="related"
    class="spell-detail"
    :data-spell-card-part="cardParts ? '' : undefined"
  >
    (see {{ sectionLabel(related, companionTitle) }})
  </span>
</template>

<style scoped>
.spell-detail {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.3;
  overflow-wrap: anywhere;
  color: var(--p-text-muted-color, #888);
}
</style>
