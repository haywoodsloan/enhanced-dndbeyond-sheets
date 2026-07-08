<script lang="ts" setup>
import { computed } from 'vue';
import type { ActionCategory, CharacterAction } from '@/services/dndbeyond/model';

const props = defineProps<{ actions: CharacterAction[] }>();

const CATEGORY_ORDER: { category: ActionCategory; label: string }[] = [
  { category: 'action', label: 'Action' },
  { category: 'bonus', label: 'Bonus Action' },
  { category: 'reaction', label: 'Reaction' },
  { category: 'other', label: 'Other' },
];

const groups = computed(() =>
  CATEGORY_ORDER.map(({ category, label }) => ({
    category,
    label,
    names: props.actions
      .filter((action) => action.category === category)
      .map((action) => action.name),
  })).filter((group) => group.names.length > 0),
);
</script>

<template>
  <div class="actions">
    <div
      v-for="group in groups"
      :key="group.category"
      class="actions__group"
      :data-category="group.category"
    >
      <span class="actions__label">{{ group.label }}</span>
      <ul class="actions__list">
        <li
          v-for="(name, index) in group.names"
          :key="index"
          class="actions__item"
          data-action
        >
          {{ name }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions__label {
  display: block;
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.actions__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 2px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.actions__item {
  position: relative;
  padding-left: 14px;
  font-size: 14px;
}

/* A disc marker to match the bulleted lists on the other cards (the grid layout
   suppresses native list markers, so draw one). */
.actions__item::before {
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
</style>
