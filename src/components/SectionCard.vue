<script lang="ts" setup>
import Card from 'primevue/card';
import AbilityScores from '@/components/cards/AbilityScores.vue';
import BasicsCard from '@/components/cards/BasicsCard.vue';
import PortraitCard from '@/components/cards/PortraitCard.vue';
import SavingThrowsCard from '@/components/cards/SavingThrowsCard.vue';
import SensesCard from '@/components/cards/SensesCard.vue';
import SkillsCard from '@/components/cards/SkillsCard.vue';
import ProficienciesCard from '@/components/cards/ProficienciesCard.vue';
import AttacksCard from '@/components/cards/AttacksCard.vue';
import ActionsCard from '@/components/cards/ActionsCard.vue';
import SpellsCard from '@/components/cards/SpellsCard.vue';
import SpellCard from '@/components/cards/SpellCard.vue';
import InventoryCard from '@/components/cards/InventoryCard.vue';
import WealthCard from '@/components/cards/WealthCard.vue';
import FeaturesCard from '@/components/cards/FeaturesCard.vue';
import NotesCard from '@/components/cards/NotesCard.vue';
import type { CardKey, Character, CharacterSection } from '@/services/dndbeyond/model';
import { inventoryListColumns, type SectionSpan } from '@/utils/layout/section-layout';
import { isSpellCardKey, spellCardKey, ToggleSpellCardsKey } from '@/utils/layout/spell-cards';
import { characterSubtitle } from '@/utils/character/character-summary';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

// `span` controls the card footprint (columns × row-units). A future `expanded`
// prop will swap between a compact and a detailed body. `hidden` renders the
// card in the off-page tray: no fixed height, no drag handle, and the toggle
// restores it to the printable pages instead of removing it. `layoutCount` /
// `layoutLabel` drive the layout cycle button (shown when a card has >1 option);
// `canCycleLayout` (false) disables it when every other layout would overflow a
// page, so the toggle only offers layouts that still fit.
const props = withDefaults(
  defineProps<{
    section: CharacterSection;
    span: SectionSpan;
    /** Explicit grid placement from the packer (`grid-column` / `grid-row`). */
    place?: { gridColumn: string; gridRow: string };
    character?: Character | null;
    hidden?: boolean;
    layoutCount?: number;
    layoutLabel?: string;
    /** False when no layout OTHER than the current one fits a page — the toggle
     * is then rendered disabled. Defaults to true (enabled). */
    canCycleLayout?: boolean;
  }>(),
  { canCycleLayout: true },
);

const emit = defineEmits<{
  hide: [key: CardKey];
  show: [key: CardKey];
  cycleLayout: [key: CardKey];
  /** The card's natural content height (px), so the sheet can shrink a
   * content-fit card's footprint to fit its text. */
  measure: [key: CardKey, height: number];
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

// For a synthetic per-spell card, the SpellEntry it renders (matched by key).
const spell = computed(() =>
  isSpellCardKey(props.section.key)
    ? props.character?.spells.find(
        (entry) => spellCardKey(entry.name) === props.section.key,
      )
    : undefined,
);

// The expand-to-cards / collapse-to-list control (injected toggle from App). It
// shows on the Spells quick-sheet (expand) and on each spell card (collapse),
// and sits in the header control group next to the layout/hide buttons.
const toggleSpellCards = inject(ToggleSpellCardsKey, undefined);
const spellControl = computed<'expand' | 'collapse' | null>(() => {
  if (props.hidden || !toggleSpellCards) return null;
  if (props.section.key === 'spells' && (props.character?.spells.length ?? 0) > 0) {
    return 'expand';
  }
  return isSpellCardKey(props.section.key) ? 'collapse' : null;
});
// Sits left of the layout button when one is present, else in the layout slot.
const spellControlRight = computed(() => ((props.layoutCount ?? 1) > 1 ? '52px' : '28px'));

// Report the card's natural content height so the sheet can shrink a
// content-fit card's footprint to its text (the packer otherwise reserves a
// count-based estimate that can leave a tall, half-empty card). Measured from
// the card's top to a zero-height sentinel just after the body: a card that
// FILLS its height keeps the sentinel at the bottom (≈ the allocated height, so
// nothing shrinks), a shorter list puts it at the content's end. No-ops without
// a layout engine (happy-dom returns 0), so tests keep the estimate.
const endRef = ref<HTMLElement | null>(null);
const CARD_CONTENT_PAD = 12;

function measure() {
  if (props.hidden) return;
  const end = endRef.value;
  const card = end?.closest('.card');
  if (!end || !card) return;
  const height = end.getBoundingClientRect().top - card.getBoundingClientRect().top;
  if (height <= 0) return;
  emit('measure', props.section.key, height + CARD_CONTENT_PAD);
}

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  void nextTick(measure);
  // Re-measure once webfonts settle (they change text heights).
  if (typeof document !== 'undefined') void document.fonts?.ready?.then(measure);
  const card = endRef.value?.closest('.card');
  if (typeof ResizeObserver !== 'undefined' && card) {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(card);
  }
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
// A layout toggle or count change alters the card's width or content, so re-fit.
watch(
  () => [props.span.cols, props.span.rows, props.section.count],
  () => void nextTick(measure),
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
        v-if="spellControl"
        type="button"
        class="card__toggle card__spell-toggle"
        :style="{ right: spellControlRight }"
        v-tooltip.bottom="{
          value: spellControl === 'expand' ? 'Show spell cards' : 'Back to spell list',
          showDelay: 500,
        }"
        :aria-label="spellControl === 'expand' ? 'Show spell cards' : 'Back to spell list'"
        @click="toggleSpellCards?.()"
      >
        <svg
          v-if="spellControl === 'expand'"
          class="card__toggle-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <svg v-else class="card__toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        v-if="!hidden && (layoutCount ?? 1) > 1"
        type="button"
        class="card__layout"
        :disabled="!canCycleLayout"
        v-tooltip.bottom="{
          value: canCycleLayout
            ? `Layout: ${layoutLabel}`
            : `Layout: ${layoutLabel} — no other layout fits the page`,
          showDelay: 500,
        }"
        :aria-label="
          canCycleLayout
            ? `Change layout (currently ${layoutLabel})`
            : `Layout ${layoutLabel}; no other layout fits the page`
        "
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
        v-tooltip.bottom="{ value: hidden ? 'Show section' : 'Hide section', showDelay: 500 }"
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
      <AttacksCard
        v-else-if="section.key === 'attacks' && character"
        :attacks="character.attacks"
      />
      <ActionsCard
        v-else-if="section.key === 'actions' && character"
        :actions="character.actions"
      />
      <SpellsCard
        v-else-if="section.key === 'spells' && character"
        :spells="character.spells"
        :spellcasting="character.spellcasting"
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
      <SpellCard v-else-if="spell" :spell="spell" />
      <p v-else-if="section.isEmpty" class="card__note">Nothing here yet.</p>
      <p v-else class="card__note">Details coming soon.</p>
      <span v-if="!hidden" ref="endRef" class="card__end" aria-hidden="true"></span>
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

/* Zero-height marker after the card body; its position IS the content's bottom,
   which the sheet measures to shrink a content-fit card down to its text. */
.card__end {
  display: block;
  height: 0;
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

/* Disabled: every other layout would overflow a page, so the toggle can't
   switch. Kept hidden-until-hover like the enabled control, but shown muted and
   unclickable so it reads as "no other layout fits". */
.card__layout:disabled {
  cursor: default;
  color: var(--p-primary-300, #d4d4d8);
  border-color: var(--p-primary-200, #e4e4e7);
}

.card:hover .card__layout:disabled,
.card__layout:disabled:focus-visible {
  opacity: 0.5;
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
