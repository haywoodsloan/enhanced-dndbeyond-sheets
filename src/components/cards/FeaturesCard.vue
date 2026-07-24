<script lang="ts" setup>
import type { FeatureGroup, FeatureItem } from '@/services/dndbeyond/model';
import { sectionLabel } from '@/utils/character/section-label';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';
import RichText from '@/components/RichText.vue';
import StructuredList from '@/components/StructuredList.vue';

withDefaults(
  defineProps<{
    features: FeatureGroup[];
    companionTitle?: string;
    rowAligned?: boolean;
  }>(),
  { companionTitle: 'Companions', rowAligned: false },
);

function needsFullWidth(item: FeatureItem): boolean {
  const parts = item.parts ?? [];
  return (
    parts.length > 1 ||
    parts.some((part) => Boolean(part.label || part.text || part.reference))
  );
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
        class="features__list"
        :class="{ 'features__list--row-aligned': rowAligned }"
      >
        <li
          v-for="(item, index) in group.items"
          :key="index"
          class="features__item"
          :class="{ 'features__item--multipart': needsFullWidth(item) }"
          data-feature
        >
          <span class="features__name">{{ item.name }}</span
          ><ResourceBoxes v-if="item.resource" :resource="item.resource" />
          <span v-if="item.reference" class="features__reference features__reference--item">
            (see {{ sectionLabel(item.reference, companionTitle) }})
          </span>
          <span
            v-for="related in item.related"
            :key="related"
            class="features__reference features__reference--item"
          >
            (see {{ sectionLabel(related, companionTitle) }})
          </span>
          <RichText v-if="item.summary" :text="item.summary" class="features__summary" />
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

/* A card that fits on one page uses independent masonry-like columns, so a
   short item never inherits empty height from a taller neighbor. */
.features__list:not(.features__list--row-aligned) {
  column-width: 220px;
  column-gap: 20px;
}

/* Once a card needs continuations, align items into rows so every horizontal
   slice boundary falls between complete features in both columns. */
.features__list--row-aligned {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  column-gap: 20px;
  row-gap: 6px;
}

.features__item {
  position: relative;
  padding-left: 14px;
  break-inside: avoid;
}

.features__list--row-aligned .features__item--multipart {
  grid-column: 1 / -1;
}

.features__list:not(.features__list--row-aligned) .features__item:not(:last-child) {
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

.features__part-name {
  margin-right: 5px;
  color: #1c1c1e;
}

.features__part-list {
  margin-top: 3px;
}

</style>
