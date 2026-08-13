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

/** Rough rendered height of an item, from the text it will show. */
function weightOf(item: FeatureItem): number {
  const parts = item.parts ?? [];
  const text =
    item.name.length +
    (item.summary?.length ?? 0) +
    (item.grantedSpells?.join(', ').length ?? 0) +
    (item.grants ?? []).reduce((total, grant) => total + grant.items.join(', ').length, 0) +
    parts.reduce(
      (total, part) =>
        total +
        part.label.length +
        part.text.length +
        (part.list?.items ?? []).reduce(
          (sum, row) => sum + (row.label?.length ?? 0) + row.text.length,
          0,
        ),
      0,
    );
  // Every part and list row starts a new line regardless of how short it is.
  const lines = parts.length + parts.reduce((total, part) => total + (part.list?.items.length ?? 0), 0);
  return text + lines * 40;
}

/**
 * Masonry columns pack tightly but leave no horizontal line free of items, so a
 * continuation card has nowhere safe to cut. Splitting a group into segments
 * restores those cut lines: each segment packs its own columns and both end
 * flush, so the boundary between segments is always safe to break at.
 *
 * Items are dealt into the shorter column, and a segment stays open until both
 * columns are full and level. Whatever is left over at the end of a segment
 * shows up as blank space beside the taller column, so a feature long enough to
 * fill a column on its own keeps taking neighbours until the gap beside it is
 * filled -- up to a ceiling, past which cut lines matter more than the gap.
 */
const COLUMN_TARGET = 450;
const COLUMN_LIMIT = COLUMN_TARGET * 3;
const LEVEL_ENOUGH = 150;

function segmentsOf(items: FeatureItem[]): FeatureItem[][] {
  if (!props.rowAligned) return [items];
  const segments: FeatureItem[][] = [];
  let columns = [
    { items: [] as FeatureItem[], weight: 0 },
    { items: [] as FeatureItem[], weight: 0 },
  ];
  for (const item of items) {
    const shorter = columns[0].weight <= columns[1].weight ? columns[0] : columns[1];
    shorter.items.push(item);
    shorter.weight += weightOf(item);
    const filled = Math.min(columns[0].weight, columns[1].weight);
    const gap = Math.abs(columns[0].weight - columns[1].weight);
    if (filled >= COLUMN_TARGET && (gap <= LEVEL_ENOUGH || filled >= COLUMN_LIMIT)) {
      segments.push(columns.flatMap((column) => column.items));
      columns = [
        { items: [], weight: 0 },
        { items: [], weight: 0 },
      ];
    }
  }
  const tail = columns.flatMap((column) => column.items);
  if (tail.length) segments.push(tail);
  return segments;
}

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
          v-for="(item, index) in segment"
          :key="index"
          class="features__item"
          data-feature
        >
          <span class="features__name">{{ item.name }}</span
          ><ResourceBoxes v-if="item.resource" :resource="item.resource" />
          <span v-if="item.reference" class="features__reference features__reference--item">
            (see {{ sectionLabel(item.reference, companionTitle) }})
          </span>
          <RichText v-if="item.summary" :text="item.summary" class="features__summary" />
          <span
            v-for="related in item.related"
            :key="related"
            class="features__reference features__reference--item"
          >
            (see {{ sectionLabel(related, companionTitle) }})
          </span>
          <span
            v-for="grant in item.grants"
            :key="grant.label"
            class="features__grants"
            data-feature-grant
          >
            <span class="features__grants-label">{{ grant.label }}:</span>
            {{ grant.items.join(', ') }}
          </span>
          <span v-if="item.grantedSpells?.length" class="features__spells" data-feature-spells>
            <span class="features__spells-label">Spells:</span>
            {{ item.grantedSpells.join(', ') }}
          </span>
          <div
            v-for="(part, pIndex) in item.parts"
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

</style>
