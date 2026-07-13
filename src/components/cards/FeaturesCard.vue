<script lang="ts" setup>
import type { FeatureGroup } from '@/services/dndbeyond/model';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';

defineProps<{ features: FeatureGroup[] }>();
</script>

<template>
  <div class="features">
    <div
      v-for="group in features"
      :key="group.label"
      class="features__group"
      :data-group="group.label"
    >
      <span class="features__label">{{ group.label }}</span>
      <ul class="features__list">
        <li v-for="(item, index) in group.items" :key="index" class="features__item" data-feature>
          <span class="features__name">{{ item.name }}</span
          ><ResourceBoxes v-if="item.resource" :resource="item.resource" />
          <span v-if="item.summary" class="features__summary">{{ item.summary }}</span>
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
</style>
