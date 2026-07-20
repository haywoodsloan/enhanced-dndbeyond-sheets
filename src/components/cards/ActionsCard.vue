<script lang="ts" setup>
import { computed } from 'vue';
import type { ActionCategory, CharacterAction } from '@/services/dndbeyond/model';
import { formatDamage } from '@/utils/character/format';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';
import RichText from '@/components/RichText.vue';

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
    actions: props.actions.filter((action) => action.category === category),
  })).filter((group) => group.actions.length > 0),
);

/** Compact meta line for an action: "1d8+4 · DC 14 CON · 30 ft.". */
function metaOf(action: CharacterAction): string {
  return [formatDamage(action.damage), action.roll, action.save, action.range]
    .filter(Boolean)
    .join(' · ');
}
</script>

<template>
  <div class="actions">
    <div
      v-for="group in groups"
      :key="group.category"
      class="actions__group"
      :data-category="group.category"
      data-card-group
    >
      <span class="actions__label">{{ group.label }}</span>
      <ul class="actions__list">
        <li
          v-for="(action, index) in group.actions"
          :key="index"
          class="actions__item"
          data-action
        >
          <span class="actions__head">
            <span class="actions__name">{{ action.name }}</span>
            <ResourceBoxes v-if="action.resource" :resource="action.resource" />
            <span v-if="metaOf(action)" class="actions__meta">{{ metaOf(action) }}</span>
          </span>
          <RichText v-if="action.summary" :text="action.summary" class="actions__summary" />
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

/* A divider line between action categories. Drawn on the BOTTOM of each group
   (except the last) so a category continuing onto a “(cont.)” card leaves no stray
   rule atop the continuation (the base card clips it off). */
.actions__group:not(:last-child) {
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
  padding-bottom: 8px;
}

.actions__label {
  display: block;
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.actions__list {
  margin: 0;
  padding: 0;
  list-style: none;
  column-width: 240px;
  column-gap: 20px;
}

.actions__item {
  position: relative;
  padding-left: 14px;
  margin-bottom: 6px;
  font-size: 14px;
  /* Keep an action's name and its blurb together in one column. */
  break-inside: avoid;
}

.actions__name {
  font-weight: 600;
}

/* Name, use-boxes, and meta share one wrapping row so they flow together and the
   use-boxes never orphan onto a lonely line when the name is long. */
.actions__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 6px;
  row-gap: 2px;
}

/* Neutralise the resource component's own left margin inside the flex row (the
   row's column-gap already spaces it). */
.actions__head :deep(.resource) {
  margin-left: 0;
}

/* The damage/save/range meta trails the name in a lighter, smaller style. */
.actions__meta {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
  white-space: nowrap;
}

/* One-line blurb of what the action does, beneath its name. */
.actions__summary {
  display: block;
  font-size: 12px;
  line-height: 1.3;
  color: var(--p-text-muted-color, #888);
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
