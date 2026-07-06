<script lang="ts" setup>
withDefaults(defineProps<{ senses?: string[] }>(), {
  senses: () => [],
});
</script>

<template>
  <ul v-if="senses.length" class="senses" data-senses>
    <li v-for="entry in senses" :key="entry" class="senses__item">{{ entry }}</li>
  </ul>
  <p v-else class="senses__empty">No special senses.</p>
</template>

<style scoped>
.senses {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

.senses__item {
  font-size: 13px;
  line-height: 1.35;
}

.senses__item + .senses__item {
  margin-top: 4px;
}

.senses__empty {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
