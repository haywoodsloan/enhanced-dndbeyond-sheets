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
  cursor: grab;
  overflow: hidden;
  border: 1px solid var(--p-primary-300, #d4d4d8);
  box-shadow: none;
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
