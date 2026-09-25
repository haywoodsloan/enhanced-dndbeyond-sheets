<script lang="ts" setup>
import type { StructuredList } from '@/services/dndbeyond/model';
import RichText from '@/components/RichText.vue';

withDefaults(defineProps<{ list: StructuredList; bullets?: boolean }>(), { bullets: true });
</script>

<template>
  <div class="structured-list" data-structured-list>
    <strong v-if="list.label" class="structured-list__label">{{ list.label }}</strong>
    <ul :class="{ 'structured-list__items--plain': !bullets }">
      <li
        v-for="(item, index) in list.items"
        :key="index"
        data-structured-list-item
        data-rich-text-bullet
      >
        <strong v-if="item.label">{{ item.label }}</strong>
        <RichText :text="item.text" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.structured-list {
  overflow-wrap: anywhere;
}

.structured-list__label {
  display: block;
}

.structured-list ul {
  margin: 2px 0 0;
  padding-left: 14px;
}

.structured-list .structured-list__items--plain {
  list-style: none;
  padding-left: 0;
}

.structured-list li + li {
  margin-top: 2px;
}

.structured-list li > strong {
  margin-right: 4px;
}
</style>
