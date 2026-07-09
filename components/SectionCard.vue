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
import type { Character, CharacterSection, SectionKey } from '@/services/dndbeyond/model';
import { inventoryListColumns, type SectionSpan } from '@/utils/section-layout';
import { characterSubtitle } from '@/utils/character-summary';
import { computed } from 'vue';

// `span` controls the card footprint (columns × row-units). A future `expanded`
// prop will swap between a compact and a detailed body. `hidden` renders the
// card in the off-page tray: no fixed height, no drag handle, and the toggle
// restores it to the printable pages instead of removing it. `layoutCount` /
// `layoutLabel` drive the layout cycle button (shown when a card has >1 option).
const props = defineProps<{
  section: CharacterSection;
  span: SectionSpan;
  /** Explicit grid placement from the packer (`grid-column` / `grid-row`). */
  place?: { gridColumn: string; gridRow: string };
  character?: Character | null;
  hidden?: boolean;
  layoutCount?: number;
  layoutLabel?: string;
}>();

const emit = defineEmits<{
  hide: [key: SectionKey];
  show: [key: SectionKey];
  cycleLayout: [key: SectionKey];
}>();

const cardStyle = computed(() => {
  if (props.hidden) return { gridColumn: `span ${props.span.cols}` };
  // On the sheet the packer places the card explicitly; without a `place`
  // (e.g. mounted in isolation) it falls back to spanning its columns at a
  // fixed height so it still renders sensibly.
  if (props.place) return props.place;
  return {
    gridColumn: `span ${props.span.cols}`,
    height: `calc(${props.span.rows} * var(--row-unit, 130px) + ${props.span.rows - 1} * var(--grid-gap, 12px))`,
  };
});

// The Basics card doubles as the sheet header: its title is the character name
// and its subtitle the race / class line. Every other card keeps its section title.
const cardTitle = computed(() =>
  props.section.key === 'basics' && props.character
    ? props.character.name
    : props.section.title,
);
const cardSubtitle = computed(() =>
  props.section.key === 'basics' && props.character
    ? characterSubtitle(props.character)
    : '',
);
</script>

<template>
  <Card
    class="card"
    :class="{ 'card--hidden': hidden }"
    :style="cardStyle"
    :data-section-key="section.key"
  >
    <template #title>
      <div class="card__title">
        <span class="card__heading">
          <span class="card__name">{{ cardTitle }}</span>
          <template v-if="cardSubtitle">
            <span class="card__title-sep" aria-hidden="true">|</span>
            <span class="card__subtitle">{{ cardSubtitle }}</span>
          </template>
        </span>
      </div>
    </template>
    <template #content>
      <span
        v-if="!hidden"
        v-tooltip.bottom="{ value: 'Drag to reorder', showDelay: 500 }"
        class="card__drag-handle"
        aria-hidden="true"
      ></span>
      <button
        v-if="!hidden && (layoutCount ?? 1) > 1"
        type="button"
        class="card__layout"
        v-tooltip.bottom="{ value: `Layout: ${layoutLabel} (click to change)`, showDelay: 500 }"
        :aria-label="`Change layout (currently ${layoutLabel})`"
        @click="emit('cycleLayout', section.key)"
      >
        <svg class="card__toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>
      <button
        type="button"
        class="card__toggle"
        v-tooltip.bottom="{
          value: hidden ? 'Show section (add back to the page)' : 'Hide section (don’t print)',
          showDelay: 500,
        }"
        :aria-label="hidden ? 'Show section' : 'Hide section'"
        @click="hidden ? emit('show', section.key) : emit('hide', section.key)"
      >
        <svg v-if="hidden" class="card__toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 8a10.645 10.645 0 0 0 20 0" />
          <path d="m4 15 1.726-2.05" />
          <path d="m9 18 .722-3.25" />
          <path d="m15 18-.722-3.25" />
          <path d="m20 15-1.726-2.05" />
        </svg>
        <svg v-else class="card__toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <PortraitCard
        v-if="section.key === 'portrait' && character?.avatarUrl"
        :avatar-url="character.avatarUrl"
      />
      <AbilityScores
        v-else-if="section.key === 'attributes' && character"
        :abilities="character.abilities"
        :cols="span.cols"
        :rows="span.rows"
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
        :columns="span.cols"
      />
      <ProficienciesCard
        v-else-if="section.key === 'proficiencies' && character"
        :proficiencies="character.proficiencies"
        :columns="span.cols"
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
        :columns="inventoryListColumns(section.count, span)"
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
   place a card can be grabbed to reorder (the `useCardDrag` handle). */
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
  touch-action: none;
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

/* Hide / show toggle: a small round button at the top-right that appears on
   hover; on a hidden card it stays visible so the section can be restored. */
.card__toggle {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--p-primary-300, #d4d4d8);
  border-radius: 999px;
  background: var(--p-primary-50, #fff);
  color: var(--p-primary-700, #6b7280);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}

/* Layout cycle: sits just left of the hide toggle at the top-right (so the two
   read as a paired control); switches the card between its curated layout
   options. Only rendered when there's more than one. */
.card__layout {
  position: absolute;
  top: 4px;
  right: 28px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--p-primary-300, #d4d4d8);
  border-radius: 999px;
  background: var(--p-primary-50, #fff);
  color: var(--p-primary-700, #6b7280);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.card:hover .card__layout,
.card__layout:focus-visible {
  opacity: 1;
}

.card__toggle-icon {
  width: 14px;
  height: 14px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.card:hover .card__toggle,
.card__toggle:focus-visible {
  opacity: 1;
}

/* Dimmed while parked in the not-printed tray; its toggle stays visible. */
.card--hidden {
  opacity: 0.72;
}

.card--hidden .card__toggle {
  opacity: 1;
}

/* Let the portrait image, skills columns, proficiency groups, ability tiles,
   inventory list, and wealth rows fill the card height (the image scales to fit
   without cropping; the other content distributes / stretches down the height
   instead of leaving space). */
.card[data-section-key='portrait'],
.card[data-section-key='skills'],
.card[data-section-key='proficiencies'],
.card[data-section-key='attributes'],
.card[data-section-key='inventory'],
.card[data-section-key='wealth'] {
  display: flex;
  flex-direction: column;
}

.card[data-section-key='portrait'] :deep(.p-card-body),
.card[data-section-key='skills'] :deep(.p-card-body),
.card[data-section-key='proficiencies'] :deep(.p-card-body),
.card[data-section-key='attributes'] :deep(.p-card-body),
.card[data-section-key='inventory'] :deep(.p-card-body),
.card[data-section-key='wealth'] :deep(.p-card-body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.card[data-section-key='portrait'] :deep(.p-card-content),
.card[data-section-key='skills'] :deep(.p-card-content),
.card[data-section-key='proficiencies'] :deep(.p-card-content),
.card[data-section-key='attributes'] :deep(.p-card-content),
.card[data-section-key='inventory'] :deep(.p-card-content),
.card[data-section-key='wealth'] :deep(.p-card-content) {
  flex: 1;
  min-height: 0;
}

/* The inventory's write-in rows run to the bottom edge, so trim the card's
   bottom padding to give them room for one more row. */
.card[data-section-key='inventory'] :deep(.p-card-body) {
  padding-bottom: 6px;
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

/* The Basics card puts the name and the race / class line on one row. */
.card__heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.card__title-sep {
  font-weight: 300;
  color: var(--p-primary-300, #cbd5e1);
}

/* Subtitle only appears on the Basics card (the race / class line). */
.card__subtitle {
  font-size: 13px;
  font-weight: 400;
  color: var(--p-primary-700, #6b7280);
}

.card__note {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
