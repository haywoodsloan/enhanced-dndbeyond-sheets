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
        <li v-for="(item, index) in group.items" :key="index" data-feature>
          {{ item.name
          }}<ResourceBoxes v-if="item.resource" :resource="item.resource" />
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

.features__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 2px 20px;
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
}
</style>
