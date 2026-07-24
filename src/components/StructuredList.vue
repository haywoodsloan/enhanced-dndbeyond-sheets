<script lang="ts" setup>
import type { StructuredList } from '@/services/dndbeyond/model';

withDefaults(defineProps<{ list: StructuredList; bullets?: boolean }>(), {
  bullets: true,
});
</script>

<template>
  <div class="structured-list" data-structured-list>
    <span v-if="list.label" class="structured-list__label">{{ list.label }}</span>
    <ul :class="{ 'structured-list__items--plain': !bullets }">
      <li
        v-for="(item, index) in list.items"
        :key="`${item.label ?? ''}-${index}`"
        class="structured-list__item"
        data-structured-list-item
      >
        <strong v-if="item.label">{{ item.label }}</strong>
        <span>{{ item.text }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.structured-list__label {
  display: block;
  font-weight: 600;
  color: #1c1c1e;
}

.structured-list ul {
  margin: 2px 0 0;
  padding-left: 16px;
}

.structured-list ul.structured-list__items--plain {
  padding-left: 0;
  list-style: none;
}

.structured-list__items--plain .structured-list__item {
  position: relative;
  padding-left: 12px;
}

.structured-list__items--plain .structured-list__item::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 0.65em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.structured-list li {
  padding-left: 1px;
}

.structured-list ul:not(.structured-list__items--plain) li::marker {
  content: '• ';
}

.structured-list li + li {
  margin-top: 2px;
}

.structured-list li strong {
  margin-right: 4px;
  color: #1c1c1e;
}
</style>