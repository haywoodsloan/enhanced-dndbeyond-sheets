<script lang="ts" setup>
import type { FeatureGroup, FeatureItem } from '@/services/dndbeyond/model';
import { sectionLabel } from '@/utils/character/section-label';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';
import RichText from '@/components/RichText.vue';
import StructuredList from '@/components/StructuredList.vue';

const props = withDefaults(
  defineProps<{
    features: FeatureGroup[];
    companionTitle?: string;
    rowAligned?: boolean;
  }>(),
  { companionTitle: 'Companions', rowAligned: false },
);

type FeaturePart = NonNullable<FeatureItem['parts']>[number];

/** One column's worth of a feature: the whole thing, or a slice of a long one. */
interface FeatureChunk {
  item: FeatureItem;
  name: string;
  parts: FeaturePart[];
  lead: boolean;
  flowing: boolean;
  /** Starts the second column: the split that levels the two best. */
  breakBefore?: boolean;
}

/** Rough rendered height of an item, from the text it will show. Measured
 * against real renders the cost is affine, not proportional: every item pays
 * for its name line and the gap below it before a word of body text is set. */
const ITEM_BASE = 80;

function weightOf(item: FeatureItem): number {
  const text =
    item.name.length +
    (item.summary?.length ?? 0) +
    (item.grantedSpells?.join(', ').length ?? 0) +
    (item.grants ?? []).reduce((total, grant) => total + grant.items.join(', ').length, 0);
  return (
    ITEM_BASE + text + (item.parts ?? []).reduce((total, part) => total + partWeight(part), 0)
  );
}

function partWeight(part: FeaturePart): number {
  const rows = part.list?.items ?? [];
  const table = part.table;
  const text =
    part.label.length +
    part.text.length +
    rows.reduce((sum, row) => sum + (row.label?.length ?? 0) + row.text.length, 0) +
    (table?.rows ?? []).reduce((sum, row) => sum + row.join('').length, 0);
  // Every part and list row starts a new line regardless of how short it is.
  const lines = 1 + rows.length + (table ? table.rows.length + 1 : 0);
  return text + lines * 40;
}

/**
 * Masonry columns pack tightly but leave no horizontal line free of items, so a
 * continuation card has nowhere safe to cut. Splitting a group into segments
 * restores those cut lines: each segment balances its own columns and both end
 * flush, so the boundary between segments is always safe to break at.
 */
const SEGMENT_WEIGHT = 1300;

/** Roughly a page-tall column of text: what one feature can take before it has
 * to carry on in the next column. */
const COLUMN_CAPACITY = 2900;

/** A feature taller than a column continues in the next one under a "(cont.)"
 * heading, cut between its named parts so the split lands somewhere readable. */
function chunksOf(item: FeatureItem): FeatureChunk[] {
  const parts = item.parts ?? [];
  const total = weightOf(item);
  const pieces = Math.ceil(total / COLUMN_CAPACITY);
  if (!props.rowAligned || pieces < 2) {
    return [{ item, name: item.name, parts, lead: true, flowing: false }];
  }
  if (parts.length < 2) {
    // Nothing to cut between, so let the text itself wrap across the columns.
    return [{ item, name: item.name, parts, lead: true, flowing: true }];
  }
  const target = total / pieces;
  const chunks: FeaturePart[][] = [];
  let current: FeaturePart[] = [];
  let weight = total - parts.reduce((sum, part) => sum + partWeight(part), 0);
  for (const [index, part] of parts.entries()) {
    const canCut =
      current.length &&
      chunks.length < pieces - 1 &&
      // "...the following rules apply:" introduces the parts after it, so a cut
      // here would strand the promise in one column and the rules in the next.
      !introducesWhatFollows(parts[index - 1]);
    if (canCut && weight + partWeight(part) > target) {
      chunks.push(current);
      current = [];
      // Every chunk repeats the feature's name, so it starts at the same base.
      weight = ITEM_BASE;
    }
    current.push(part);
    weight += partWeight(part);
  }
  chunks.push(current);
  return chunks.map((chunkParts, index) => ({
    item,
    name: index ? `${item.name} (cont.)` : item.name,
    parts: chunkParts,
    lead: index === 0,
    flowing: false,
  }));
}

/** A part ending in a colon is a lead-in to the parts after it. */
function introducesWhatFollows(part: FeaturePart | undefined): boolean {
  return part != null && /:\s*$/.test(part.text);
}

/**
 * Column flow can only cut a segment at one point, and the browser already picks
 * the cut that levels the columns best. Reordering to "deal" items into columns
 * fights that: it can pair the two heaviest items and leave a light one alone.
 * So reading order is kept and only the segment boundaries are chosen here.
 */
function segmentsOf(items: FeatureItem[]): FeatureChunk[][] {
  const segments: FeatureChunk[][] = [];
  let current: FeatureChunk[] = [];
  let weight = 0;
  const flush = () => {
    if (current.length) segments.push(current);
    current = [];
    weight = 0;
  };
  for (const item of items) {
    const chunks = chunksOf(item);
    // A feature that fills more than a column owns its segment, so the columns
    // still end level either side of it and the card can cut there.
    if (chunks.length > 1 || chunks[0].flowing) {
      flush();
      segments.push(chunks);
      continue;
    }
    current.push(chunks[0]);
    weight += weightOf(item);
    // Only a card that has to survive a page cut is broken into segments; the
    // rest stay one list for the browser to balance.
    if (props.rowAligned && weight >= SEGMENT_WEIGHT) flush();
  }
  flush();
  for (const segment of segments) markColumnBreak(segment);
  return segments;
}

/**
 * Column flow picks its own cut, and with unbreakable items it often picks a bad
 * one — leaving one column half empty beside a long feature. The cut that levels
 * the columns is cheap to find, so it is marked and forced.
 */
function markColumnBreak(segment: FeatureChunk[]): void {
  if (segment.length < 2) return;
  const weights = segment.map((chunk) => chunkWeight(chunk));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let running = 0;
  let best = { index: 1, cost: Number.POSITIVE_INFINITY };
  for (let index = 1; index < segment.length; index += 1) {
    running += weights[index - 1];
    const cost = Math.max(running, total - running);
    if (cost < best.cost) best = { index, cost };
  }
  segment[best.index].breakBefore = true;
}

function chunkWeight(chunk: FeatureChunk): number {
  const parts = chunk.parts.reduce((sum, part) => sum + partWeight(part), 0);
  return chunk.lead ? weightOf(chunk.item) - itemPartsWeight(chunk.item) + parts : ITEM_BASE + parts;
}

const itemPartsWeight = (item: FeatureItem) =>
  (item.parts ?? []).reduce((sum, part) => sum + partWeight(part), 0);

function partSpellLabel(part: NonNullable<FeatureItem['parts']>[number]): string {
  if (/cantrips?/i.test(part.label)) return 'Cantrips';
  return part.grantedSpells?.length === 1 ? 'Spell' : 'Spells';
}
</script>

<template>
  <div class="features">
    <div
      v-for="group in features"
      :key="group.label"
      class="features__group"
      :data-group="group.label"
      data-card-group
    >
      <span class="features__label">{{ group.label }}</span>
      <ul
        v-for="(segment, segmentIndex) in segmentsOf(group.items)"
        :key="segmentIndex"
        class="features__list"
        data-feature-segment
      >
        <li
          v-for="(chunk, index) in segment"
          :key="index"
          class="features__item"
          :class="{
            'features__item--flowing': chunk.flowing,
            'features__item--column': chunk.breakBefore,
          }"
          data-feature
        >
          <span class="features__name">{{ chunk.name }}</span
          ><ResourceBoxes v-if="chunk.lead && chunk.item.resource" :resource="chunk.item.resource" />
          <span
            v-if="chunk.lead && chunk.item.reference"
            class="features__reference features__reference--item"
          >
            (see {{ sectionLabel(chunk.item.reference, companionTitle) }})
          </span>
          <RichText
            v-if="chunk.lead && chunk.item.summary"
            :text="chunk.item.summary"
            class="features__summary"
          />
          <template v-if="chunk.lead">
            <span
              v-for="related in chunk.item.related"
              :key="related"
              class="features__reference features__reference--item"
            >
              (see {{ sectionLabel(related, companionTitle) }})
            </span>
            <span
              v-for="grant in chunk.item.grants"
              :key="grant.label"
              class="features__grants"
              data-feature-grant
            >
              <span class="features__grants-label">{{ grant.label }}:</span>
              {{ grant.items.join(', ') }}
            </span>
            <span
              v-if="chunk.item.grantedSpells?.length"
              class="features__spells"
              data-feature-spells
            >
              <span class="features__spells-label">Spells:</span>
              {{ chunk.item.grantedSpells.join(', ') }}
            </span>
          </template>
          <div
            v-for="(part, pIndex) in chunk.parts"
            :key="pIndex"
            class="features__part"
            data-feature-part
          >
            <p class="features__part-line">
              <strong v-if="part.label" class="features__part-name">{{ part.label }}</strong>
              <span v-if="part.reference" class="features__reference">
                (see {{ sectionLabel(part.reference, companionTitle) }})
              </span>
              <span v-if="part.text">{{ part.text }}</span>
            </p>
            <span
              v-if="part.grantedSpells?.length"
              class="features__part-spells"
              data-feature-part-spells
            >
              <strong>{{ partSpellLabel(part) }}:</strong>
              {{ part.grantedSpells.join(', ') }}
            </span>
            <div v-if="part.list?.items.length" class="features__part-list" data-feature-list>
              <StructuredList :list="part.list" />
            </div>
            <div
              v-if="part.table?.rows.length"
              class="features__table"
              :style="{
                gridTemplateColumns: `repeat(${part.table.columns.length}, minmax(0, auto))`,
              }"
              data-feature-table
            >
              <div class="features__table-row features__table-row--head">
                <span v-for="(column, cIndex) in part.table.columns" :key="cIndex">
                  {{ column }}
                </span>
              </div>
              <div
                v-for="(row, rIndex) in part.table.rows"
                :key="rIndex"
                class="features__table-row"
              >
                <span v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</span>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.features {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* A divider line between feature categories. Drawn on the BOTTOM of each group
   (except the last) so when a category continues onto a “(cont.)” card the rule
   sits at the base card's clipped-off edge — no stray line atop the continuation. */
.features__group:not(:last-child) {
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
  padding-bottom: 10px;
}

.features__label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.features__list {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}

/* Every segment packs its own masonry columns, so a short item never inherits
   empty height from a taller neighbour. */
.features__list {
  column-width: 220px;
  column-gap: 20px;
}

/* Segments sit flush; the gap between them is the safe cut line. */
.features__list + .features__list {
  margin-top: 6px;
}

.features__item {
  position: relative;
  padding-left: 14px;
  break-inside: avoid;
}

.features__item:not(:last-child) {
  margin-bottom: 6px;
}

/* Too tall for one column, so it carries on down the next one. */
.features__item--flowing {
  break-inside: auto;
}

.features__item--column {
  break-before: column;
}

/* A disc marker to match the other bulleted list cards (a multi-column list can
   clip native list markers at the column edge, so draw our own). */
.features__item::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 0.7em;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.features__name {
  font-weight: 600;
}

/* One-line blurb of what the feature does, beneath its name. */
.features__summary {
  display: block;
  font-size: 12px;
  line-height: 1.3;
  color: var(--p-text-muted-color, #888);
}

.features__spells,
.features__grants {
  display: block;
  font-size: 12px;
  line-height: 1.3;
  color: var(--p-text-muted-color, #888);
}

.features__spells-label,
.features__grants-label {
  font-weight: 600;
  color: #1c1c1e;
}

.features__reference {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}

.features__reference--item {
  display: block;
  line-height: 1.3;
}

/* A named sub-part of a feature (e.g. Circle of Mortality's "Pull of Death"),
   rendered as a run-in bold heading followed by its text. An action sub-part
   has no text (its detail lives on the Actions card); an un-named rider has no
   heading. */
.features__part {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--p-text-muted-color, #888);
}

.features__part-line {
  margin: 0;
}

.features__part-spells {
  display: block;
  margin-top: 2px;
}

.features__part-spells strong {
  color: #1c1c1e;
}

.features__part-name {
  margin-right: 5px;
  color: #1c1c1e;
}

.features__part-list {
  margin-top: 3px;
}

/* One shared grid for the header and every row (via `subgrid`), so the columns
   line up; only as wide as its cells, since these sit inside a narrow column. */
.features__table {
  display: grid;
  width: max-content;
  max-width: 100%;
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.25;
}

.features__table-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
}

.features__table-row > span {
  min-width: 0;
  padding: 2px 5px;
}

.features__table-row > span + span {
  border-left: 1px solid var(--p-primary-200, #e4e4e7);
}

.features__table-row--head {
  font-weight: 700;
  color: var(--p-text-muted-color, #888);
  border-top: 0;
  background: var(--p-primary-50, #fafafa);
}

</style>
