<script lang="ts" setup>
import type { FeatureGroup } from '@/services/dndbeyond/model';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';
import RichText from '@/components/RichText.vue';

defineProps<{ features: FeatureGroup[] }>();
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
      <ul class="features__list">
        <li v-for="(item, index) in group.items" :key="index" class="features__item" data-feature>
          <span class="features__name">{{ item.name }}</span
          ><ResourceBoxes v-if="item.resource" :resource="item.resource" />
          <RichText v-if="item.summary" :text="item.summary" class="features__summary" />
          <p
            v-for="(part, pIndex) in item.parts"
            :key="pIndex"
            class="features__part"
            data-feature-part
          >
            <strong v-if="part.label" class="features__part-name">{{ part.label }}</strong>
            <span v-if="part.text">{{ part.text }}</span>
          </p>
          <span
            v-for="spell in item.spellUses"
            :key="spell.name"
            class="features__spell"
            data-feature-spell
          >
            <span class="features__spell-name">{{ spell.name }}</span
            ><ResourceBoxes :resource="spell.pool" />
          </span>
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

/* A masonry-style multi-column list: each item takes only its own height and the
   columns pack independently, so a short item never leaves a gap before the next
   one just because the item beside it is taller (a grid aligns rows and forces
   that gap). As many >=240px columns as the card width allows. */
.features__list {
  margin: 0;
  padding: 0;
  list-style: none;
  column-width: 240px;
  column-gap: 20px;
  font-size: 14px;
}

.features__item {
  position: relative;
  padding-left: 14px;
  margin-bottom: 6px;
  /* Keep a feature's name and its blurb together in one column. */
  break-inside: avoid;
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

.features__part-name {
  margin-right: 5px;
  color: #1c1c1e;
}

/* A limited-use spell the feature grants free casts of: its name + checkboxes. */
.features__spell {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.3;
}

.features__spell-name {
  font-weight: 600;
  color: #1c1c1e;
}

</style>
