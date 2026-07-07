<script lang="ts" setup>
import Card from 'primevue/card';
import AbilityScores from '@/components/AbilityScores.vue';
import BasicsCard from '@/components/BasicsCard.vue';
import PortraitCard from '@/components/PortraitCard.vue';
import SavingThrowsCard from '@/components/SavingThrowsCard.vue';
import SensesCard from '@/components/SensesCard.vue';
import SkillsCard from '@/components/SkillsCard.vue';
import ProficienciesCard from '@/components/ProficienciesCard.vue';
import ActionsCard from '@/components/ActionsCard.vue';
import SpellsCard from '@/components/SpellsCard.vue';
import InventoryCard from '@/components/InventoryCard.vue';
import WealthCard from '@/components/WealthCard.vue';
import FeaturesCard from '@/components/FeaturesCard.vue';
import NotesCard from '@/components/NotesCard.vue';
import type { Character, CharacterSection } from '@/services/dndbeyond/model';
import type { SectionSpan } from '@/utils/section-layout';

// `span` controls the card footprint (columns × row-units). A future `expanded`
// prop will swap between a compact and a detailed body.
defineProps<{
  section: CharacterSection;
  span: SectionSpan;
  character?: Character | null;
}>();
</script>

<template>
  <Card
    class="card"
    :style="{
      gridColumn: `span ${span.cols}`,
      height: `calc(${span.rows} * var(--row-unit, 130px) + ${span.rows - 1} * var(--grid-gap, 12px))`,
    }"
    :data-section-key="section.key"
  >
    <template #title>
      <div class="card__title">
        <span>{{ section.title }}</span>
      </div>
    </template>
    <template #content>
      <span class="card__drag-handle" aria-hidden="true" title="Drag to reorder"></span>
      <PortraitCard
        v-if="section.key === 'portrait' && character?.avatarUrl"
        :avatar-url="character.avatarUrl"
      />
      <AbilityScores
        v-else-if="section.key === 'attributes' && character"
        :abilities="character.abilities"
      />
      <BasicsCard
        v-else-if="section.key === 'basics' && character"
        :basics="character.basics"
      />
      <SavingThrowsCard
        v-else-if="section.key === 'savingThrows' && character"
        :saves="character.savingThrows"
        :defences="character.defences"
      />
      <SensesCard
        v-else-if="section.key === 'senses' && character"
        :senses="character.senses"
      />
      <SkillsCard
        v-else-if="section.key === 'skills' && character"
        :skills="character.skills"
      />
      <ProficienciesCard
        v-else-if="section.key === 'proficiencies' && character"
        :proficiencies="character.proficiencies"
      />
      <ActionsCard
        v-else-if="section.key === 'actions' && character"
        :actions="character.actions"
      />
      <SpellsCard
        v-else-if="section.key === 'spells' && character"
        :spells="character.spells"
      />
      <InventoryCard
        v-else-if="section.key === 'inventory' && character"
        :inventory="character.inventory"
      />
      <WealthCard
        v-else-if="section.key === 'wealth' && character"
        :wealth="character.wealth"
      />
      <FeaturesCard
        v-else-if="section.key === 'features' && character"
        :features="character.features"
      />
      <NotesCard
        v-else-if="section.key === 'notes' && character"
        :notes="character.notes"
      />
      <p v-else-if="section.isEmpty" class="card__note">Nothing here yet.</p>
      <p v-else class="card__note">Details coming soon.</p>
    </template>
  </Card>
</template>

<style scoped>
.card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--p-primary-300, #d4d4d8);
  box-shadow: none;
}

/* Drag handle: a grip bar at the top-center that appears on hover; the only
   place a card can be grabbed to reorder (SortableJS `handle`). */
.card__drag-handle {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  width: 40px;
  height: 9px;
  border-radius: 999px;
  background: var(--p-primary-300, #b8b8bd);
  opacity: 0;
  cursor: grab;
  transition: opacity 0.12s ease;
}

/* A lighter grip bar (~1/3 width) centered in the handle. */
.card__drag-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 33%;
  height: 3px;
  border-radius: 999px;
  background: var(--p-primary-100, #e5e5e5);
}

.card:hover .card__drag-handle {
  opacity: 0.9;
}

.card__drag-handle:active {
  cursor: grabbing;
}

/* Let the portrait fill its card so the image can scale to fit without cropping. */
.card[data-section-key='portrait'] {
  display: flex;
  flex-direction: column;
}

.card[data-section-key='portrait'] :deep(.p-card-body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.card[data-section-key='portrait'] :deep(.p-card-content) {
  flex: 1;
  min-height: 0;
}

/* The image speaks for itself — no need for a "Portrait" heading. */
.card[data-section-key='portrait'] :deep(.p-card-caption) {
  display: none;
}

.card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 15px;
  color: var(--p-primary-color);
}

.card__note {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
