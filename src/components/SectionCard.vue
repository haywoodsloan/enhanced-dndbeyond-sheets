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
import CompanionsCard from '@/components/cards/CompanionsCard.vue';
import RuleTablesCard from '@/components/cards/RuleTablesCard.vue';
import SpellCard from '@/components/cards/SpellCard.vue';
import InventoryCard from '@/components/cards/InventoryCard.vue';
import WealthCard from '@/components/cards/WealthCard.vue';
import FeaturesCard from '@/components/cards/FeaturesCard.vue';
import NotesCard from '@/components/cards/NotesCard.vue';
import type { CardKey, Character, CharacterSection } from '@/services/dndbeyond/model';
import { inventoryListColumns, type SectionSpan } from '@/utils/layout/section-layout';
import { isSpellCardKey, spellCardKey, ToggleSpellCardsKey } from '@/utils/layout/spell-cards';
import {
  continuationBaseKey,
  isContinuationKey,
  type CardMeasurement,
} from '@/utils/layout/card-continuation';
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
    /** Body-relative px this card's body is translated up by when it's a
     * continuation slice of an overflowing card (0 for a normal/base card). */
    sliceOffset?: number;
    /** Body-relative px this card's slice is tall. When set (an overflowing
     * card), the body is clipped to exactly `[sliceOffset, sliceOffset+height]`
     * so no partial item peeks in from an adjacent slice. */
    sliceHeight?: number;
    /** Item index range `[sliceStart, sliceEnd)` this card shows (set only when
     * sliced) — the card clips to its OWN live item edges for these, so the cut
     * always lands between whole items in the current layout. */
    sliceStart?: number;
    sliceEnd?: number;
    /** Use row-aligned feature items when masonry has no safe page break. */
    rowAlignedFeatures?: boolean;
    /** Use row-aligned action items when masonry has no safe page break. */
    rowAlignedActions?: boolean;
  }>(),
  { canCycleLayout: true, sliceOffset: 0 },
);

const emit = defineEmits<{
  hide: [key: CardKey];
  show: [key: CardKey];
  cycleLayout: [key: CardKey];
  /** The card's measured body geometry, so the sheet can size a content-fit
   * card's footprint to its text and split it across continuation cards. */
  measure: [key: CardKey, measurement: CardMeasurement];
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
const cardMeta = computed(() =>
  props.section.key === 'basics' && props.character
    ? [props.character.size, props.character.creatureType].filter(Boolean).join(' · ')
    : '',
);
const companionTitle = computed(
  () =>
    props.character?.sections.find((section) => section.key === 'companions')?.title ??
    'Companions',
);

// A continuation card renders the SAME body as its base card, shifted up to show
// the overflow slice; `bodyKey` is the base key its content dispatches on.
const bodyKey = computed(() => continuationBaseKey(props.section.key));
const isContinuation = computed(() => isContinuationKey(props.section.key));

// This card's own live item-bottom offsets (body-relative), measured from its
// OWN DOM in `measure()`. Clipping to these — rather than to the sheet's
// snapshot — guarantees a slice cut lands on a real item edge in the CURRENT
// layout, so text is never split across cards even if the measurement the sheet
// used to size footprints was momentarily stale.
const itemBreaks = ref<number[]>([]);
// For a continuation that starts at a group boundary, the group's OWN top to clip
// to (parallel to `itemBreaks`), so the leading category/level divider doesn't
// show at the top of the “(cont.)” card. Falls back to the item break otherwise.
const groupClipTops = ref<number[]>([]);

const bodyStyle = computed(() => {
  // Not a sliced (overflowing) card → render the whole body, no clip/transform.
  if (props.sliceEnd == null) return {};
  const breaks = itemBreaks.value;
  if (breaks.length === 0) {
    // Before this card has measured its items (and in tests with no layout
    // engine): fall back to the sheet's measured slice pixels.
    const offset = props.sliceOffset;
    const bottom = `calc(100% - ${offset + (props.sliceHeight ?? 0)}px)`;
    return {
      ...(offset ? { transform: `translateY(-${offset}px)` } : {}),
      clipPath: `inset(${offset}px 0 ${bottom} 0)`,
    };
  }
  // Clip to this card's item range using its own live boundaries: translate up to
  // the first item's top (the previous item's bottom) and clip the bottom at the
  // last item's bottom — no bottom clip for the final slice (runs to the end).
  const start = props.sliceStart ?? 0;
  const top = start > 0 ? (groupClipTops.value[start - 1] ?? breaks[start - 1] ?? 0) : 0;
  const bottomInset =
    props.sliceEnd >= breaks.length ? '0' : `calc(100% - ${breaks[props.sliceEnd - 1]}px)`;
  return {
    ...(top ? { transform: `translateY(-${top}px)` } : {}),
    clipPath: `inset(${top}px 0 ${bottomInset} 0)`,
  };
});

// For a synthetic per-spell card, the SpellEntry it renders (matched by key).
const spell = computed(() =>
  isSpellCardKey(bodyKey.value)
    ? props.character?.spells.find((entry) => spellCardKey(entry.name) === bodyKey.value)
    : undefined,
);

// The expand-to-cards / collapse-to-list control (injected toggle from App). It
// shows on the Spells quick-sheet (expand) and on each spell card (collapse),
// and sits in the header control group next to the layout/hide buttons.
const toggleSpellCards = inject(ToggleSpellCardsKey, undefined);
const spellControl = computed<'expand' | 'collapse' | null>(() => {
  if (props.hidden || isContinuation.value || !toggleSpellCards) return null;
  if (props.section.key === 'spells' && (props.character?.spells.length ?? 0) > 0) {
    return 'expand';
  }
  return isSpellCardKey(props.section.key) ? 'collapse' : null;
});
// Sits left of the layout button when one is present, else in the layout slot.
const spellControlRight = computed(() => ((props.layoutCount ?? 1) > 1 ? '52px' : '28px'));
const spellLegendMargin = computed(() => {
  if (props.hidden) return '28px';
  return '0px';
});

// Report the card's body geometry so the sheet can size a content-fit card's
// footprint to its text and split an over-tall card across continuation cards.
// We measure the wrapping `.card__body`: its height is the natural content
// height (the packer otherwise reserves a count-based estimate that can clip a
// tall body or leave a half-empty card), `chrome` is the title/padding above it,
// and `breaks` are the item boundaries a slice may end on. No-ops without a
// layout engine (happy-dom returns 0), so tests keep the estimate.
const bodyRef = ref<HTMLElement | null>(null);

// The per-item elements a card may break between when its content overflows
// onto a continuation card (one selector across every content-fit card type).
const BREAK_ITEMS =
  '[data-spell],[data-spell-card-part],[data-action],[data-attack],[data-feature],[data-feature-part],[data-companion-part],[data-rule-row]';

function measure() {
  if (props.hidden) return;
  const body = bodyRef.value;
  const card = body?.closest('.card');
  if (!body || !card) return;
  const bodyRect = body.getBoundingClientRect();
  const total = bodyRect.height;
  if (total <= 0) return;
  // Each break item's top/bottom edge, body-relative.
  const breakItems = Array.from(body.querySelectorAll(BREAK_ITEMS)).filter(
    (element) => {
      if (element.hasAttribute('data-feature')) {
        const rowAligned = element
          .closest('.features__list')
          ?.classList.contains('features__list--row-aligned');
        return !rowAligned || !element.classList.contains('features__item--multipart');
      }
      if (element.hasAttribute('data-feature-part')) {
        const feature = element.closest('[data-feature]');
        return Boolean(
          feature?.closest('.features__list')?.classList.contains('features__list--row-aligned') &&
          feature.classList.contains('features__item--multipart'),
        );
      }
      return true;
    },
  );
  const rects = breakItems.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - bodyRect.top, bottom: r.bottom - bodyRect.top };
  });
  const EDGE = 0.5;
  const breaks = rects
    .map((r) => r.bottom)
    .filter((offset) => offset > 0)
    // Keep only "safe" cut lines that don't pass THROUGH an item. In a masonry
    // multi-column list the columns end at different heights, so one column's
    // item-bottom would slice an item still running in another column; a line is
    // only safe where every column has ended (e.g. a group boundary). The
    // row-aligned grid cards share each row's bottom across both items, so every
    // break is already safe there and this filter is a no-op.
    .filter((offset) => !rects.some((r) => r.top < offset - EDGE && r.bottom > offset + EDGE))
    .sort((a, b) => a - b);
  // Store this card's OWN item edges for self-clipping. A continuation's body is
  // translated + clipped, but those are visual only — item boxes keep their
  // layout positions, so the edges relative to the body top are the same. Skip
  // the update when unchanged to avoid needless re-renders.
  // Group (category/level) box tops, so a continuation that starts at a group
  // boundary can clip to the group's OWN top — hiding the between-groups divider
  // (and its gap) that would otherwise straddle the page break and show at the top
  // of the “(cont.)” card. Non-grouped cards have none, so this stays a no-op.
  const groupTops = Array.from(body.querySelectorAll('[data-card-group]'))
    .map((el) => el.getBoundingClientRect().top - bodyRect.top)
    .sort((a, b) => a - b);
  // For each safe break, the clip-top a continuation starting right after it should
  // use: the next group's top when a group begins in the gap after the break (so
  // the leading divider is clipped), else the break itself.
  const groupClips = breaks.map((value, i) => {
    const next = breaks[i + 1] ?? Infinity;
    return groupTops.find((t) => t > value + EDGE && t < next - EDGE) ?? value;
  });
  const changed =
    breaks.length !== itemBreaks.value.length ||
    breaks.some((value, i) => Math.abs(value - itemBreaks.value[i]) > 0.5);
  if (changed) itemBreaks.value = breaks;
  const clipsChanged =
    groupClips.length !== groupClipTops.value.length ||
    groupClips.some((value, i) => Math.abs(value - groupClipTops.value[i]) > 0.5);
  if (clipsChanged) groupClipTops.value = groupClips;
  // Continuations self-clip but don't report to the sheet — the base card's
  // measurement drives how the section is sliced into cards.
  if (isContinuation.value) return;
  const chrome = bodyRect.top - card.getBoundingClientRect().top;
  emit('measure', props.section.key, { chrome, total, breaks });
}

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  void nextTick(measure);
  // Re-measure once webfonts settle (they change text heights).
  if (typeof document !== 'undefined') void document.fonts?.ready?.then(measure);
  // Observe the BODY, not the card: its height tracks the CONTENT, so a summary
  // wrapping, a webfont swap, or a width change all re-measure (a card-sized
  // observer wouldn't fire once the footprint is fixed, leaving stale breaks).
  const body = bodyRef.value;
  if (typeof ResizeObserver !== 'undefined' && body) {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(body);
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
    :class="{ 'card--hidden': hidden, 'card--narrow': span.cols < 3 }"
    :style="cardStyle"
    :data-section-key="section.key"
  >
    <template #title>
      <div
        class="card__title"
        :class="{ 'card__title--spells': bodyKey === 'spells' }"
      >
        <span class="card__heading">
          <span class="card__name">{{ cardTitle }}</span>
          <template v-if="cardSubtitle">
            <span class="card__title-sep" aria-hidden="true">|</span>
            <span class="card__subtitle">{{ cardSubtitle }}</span>
          </template>
          <template v-if="cardMeta">
            <span class="card__title-sep" aria-hidden="true">|</span>
            <span class="card__meta">{{ cardMeta }}</span>
          </template>
        </span>
        <div
          v-if="bodyKey === 'spells'"
          class="card__spell-legend"
          :style="{ '--spell-legend-margin': spellLegendMargin }"
          aria-label="Spell tags"
        >
          <span class="card__spell-legend-group" aria-label="Spell tags">
            <span class="card__spell-legend-item">
              <b class="card__spell-legend-tag">C</b>
              <span>Concentration</span>
            </span>
            <span class="card__spell-legend-item">
              <b class="card__spell-legend-tag">R</b>
              <span>Ritual</span>
            </span>
          </span>
          <span class="card__spell-legend-sep" aria-hidden="true">|</span>
          <span
            class="card__spell-legend-group card__spell-legend-group--plain"
            aria-label="Components"
          >
            <span class="card__spell-legend-item">
              <b class="card__spell-legend-tag card__spell-legend-tag--plain">V</b>
              <span>Verbal</span>
            </span>
            <span class="card__spell-legend-item">
              <b class="card__spell-legend-tag card__spell-legend-tag--plain">S</b>
              <span>Somatic</span>
            </span>
            <span class="card__spell-legend-item">
              <b class="card__spell-legend-tag card__spell-legend-tag--plain">M</b>
              <span>Material</span>
            </span>
          </span>
          <span class="card__spell-legend-sep" aria-hidden="true">|</span>
          <span
            class="card__spell-legend-group card__spell-legend-group--plain"
            aria-label="Casting time"
          >
            <span class="card__spell-legend-item">
              <b class="card__spell-legend-tag card__spell-legend-tag--plain">A</b>
              <span>Action</span>
            </span>
            <span class="card__spell-legend-item">
              <b class="card__spell-legend-tag card__spell-legend-tag--plain">BA</b>
              <span>Bonus Action</span>
            </span>
          </span>
        </div>
      </div>
    </template>
    <template #content>
      <button
        v-if="!hidden && !isContinuation"
        type="button"
        v-tooltip.bottom="{ value: 'Drag or use arrow keys to move', showDelay: 500 }"
        class="card__drag-handle"
        :aria-label="`Move ${section.title} card; use arrow keys`"
      ></button>
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
        v-if="!hidden && !isContinuation && (layoutCount ?? 1) > 1"
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
        v-if="!isContinuation"
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
      <div ref="bodyRef" class="card__body" :style="bodyStyle">
        <PortraitCard
          v-if="bodyKey === 'portrait' && character"
          :avatar-url="character.avatarUrl ?? ''"
        />
        <AbilityScores
          v-else-if="bodyKey === 'attributes' && character"
          :abilities="character.abilities"
          :cols="span.cols"
          :rows="span.rows"
        />
        <BasicsCard
          v-else-if="bodyKey === 'basics' && character"
          :basics="character.basics"
        />
        <SavingThrowsCard
          v-else-if="bodyKey === 'savingThrows' && character"
          :saves="character.savingThrows"
          :defences="character.defences"
        />
        <SensesCard
          v-else-if="bodyKey === 'senses' && character"
          :senses="character.senses"
        />
        <SkillsCard
          v-else-if="bodyKey === 'skills' && character"
          :skills="character.skills"
          :columns="span.cols"
        />
        <ProficienciesCard
          v-else-if="bodyKey === 'proficiencies' && character"
          :proficiencies="character.proficiencies"
          :columns="span.cols"
        />
        <AttacksCard
          v-else-if="bodyKey === 'attacks' && character"
          :attacks="character.attacks"
        />
        <ActionsCard
          v-else-if="bodyKey === 'actions' && character"
          :actions="character.actions"
          :companion-title="companionTitle"
          :row-aligned="rowAlignedActions"
        />
        <SpellsCard
          v-else-if="bodyKey === 'spells' && character"
          :spells="character.spells"
          :spellcasting="character.spellcasting"
          :companion-title="companionTitle"
        />
        <CompanionsCard
          v-else-if="bodyKey === 'companions' && character"
          :companions="character.companions"
          :columns="span.cols"
        />
        <RuleTablesCard
          v-else-if="bodyKey === 'tables' && character"
          :tables="character.ruleTables"
        />
        <InventoryCard
          v-else-if="bodyKey === 'inventory' && character"
          :inventory="character.inventory"
          :columns="inventoryListColumns(section.count, span)"
        />
        <WealthCard
          v-else-if="bodyKey === 'wealth' && character"
          :wealth="character.wealth"
        />
        <FeaturesCard
          v-else-if="bodyKey === 'features' && character"
          :features="character.features"
          :companion-title="companionTitle"
          :row-aligned="rowAlignedFeatures"
        />
        <NotesCard v-else-if="bodyKey === 'notes'" />
        <SpellCard v-else-if="spell" :spell="spell" :companion-title="companionTitle" />
        <p v-else-if="section.isEmpty" class="card__note">Nothing here yet.</p>
        <p v-else class="card__note">Details coming soon.</p>
      </div>
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

/* Wraps the card body. Its natural height is what the sheet measures to size a
   content-fit card and to slice an over-tall one onto continuation cards; a
   continuation translates it up to reveal its slice and `overflow: hidden`
   clips the earlier slices (so they don't bleed up over the title). */
.card__body {
  display: block;
  overflow: hidden;
}

.card__spell-legend {
  flex: 0 1 auto;
  width: max-content;
  max-width: 100%;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-left: auto;
  margin-right: var(--spell-legend-margin, 0);
  font-size: 11px;
  line-height: 1.25;
  color: var(--p-text-muted-color, #888);
}

.card__spell-legend-group {
  display: inline-flex;
  flex: none;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.card__spell-legend-sep {
  flex: none;
  color: var(--p-primary-300, #cbd5e1);
}

.card--narrow .card__spell-legend {
  display: grid;
  grid-template-rows: repeat(3, auto);
  justify-items: start;
  row-gap: 5px;
}

.card--narrow .card__spell-legend-group {
  width: 100%;
  justify-content: space-between;
}

.card--narrow .card__spell-legend-group--plain {
  box-sizing: border-box;
  padding-left: 4px;
}

.card--narrow .card__spell-legend-sep {
  display: none;
}

.card__spell-legend-item {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  white-space: nowrap;
}

.card__spell-legend-tag {
  padding: 0 3px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color, #888);
  border: 1px solid var(--p-primary-200, #e4e4e7);
  border-radius: 3px;
}

.card__spell-legend-tag--plain {
  padding: 0;
  border: 0;
  border-radius: 0;
}

@media print {
  .card__spell-legend {
    margin-right: 0;
  }
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
  padding: 0;
  border: 0;
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

.card:hover .card__drag-handle,
.card__drag-handle:focus-visible {
  opacity: 0.9;
}

.card__drag-handle:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
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
.card[data-section-key='wealth'] :deep(.p-card-body),
.card[data-section-key='savingThrows'] :deep(.p-card-body),
.card[data-section-key='senses'] :deep(.p-card-body),
.card[data-section-key='notes'] :deep(.p-card-body) {
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
.card[data-section-key='wealth'] :deep(.p-card-content),
.card[data-section-key='savingThrows'] :deep(.p-card-content),
.card[data-section-key='senses'] :deep(.p-card-content),
.card[data-section-key='notes'] :deep(.p-card-content) {
  flex: 1;
  min-height: 0;
}

/* These "fill" cards size to the card (not their text), and their inner card
   uses height:100%, so the body wrapper must fill the content area too. */
.card[data-section-key='portrait'] .card__body,
.card[data-section-key='skills'] .card__body,
.card[data-section-key='proficiencies'] .card__body,
.card[data-section-key='attributes'] .card__body,
.card[data-section-key='inventory'] .card__body,
.card[data-section-key='wealth'] .card__body,
.card[data-section-key='savingThrows'] .card__body,
.card[data-section-key='senses'] .card__body,
.card[data-section-key='notes'] .card__body {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

.card__title--spells {
  align-items: flex-start;
  flex-wrap: wrap;
}

.card__title--spells .card__heading {
  flex: none;
}

.card__title--spells .card__name {
  overflow: visible;
  text-overflow: clip;
}

/* The Basics card puts name, race/class, and size/type on one row. */
.card__heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.card__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__title-sep {
  flex: none;
  font-weight: 300;
  color: var(--p-primary-300, #cbd5e1);
}

/* Subtitle only appears on the Basics card (the race / class line). */
.card__subtitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 400;
  color: var(--p-primary-700, #6b7280);
}

.card__meta {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 400;
  color: var(--p-primary-700, #6b7280);
}

.card__note {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
