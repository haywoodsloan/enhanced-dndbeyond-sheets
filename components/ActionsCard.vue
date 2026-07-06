<script lang="ts" setup>
import type { CharacterAction } from '@/services/dndbeyond/model';

defineProps<{ actions: CharacterAction[] }>();
</script>

<template>
  <ul class="actions">
    <li
      v-for="(action, index) in actions"
      :key="index"
      class="actions__item"
      data-action
    >
      {{ action.name }}
    </li>
  </ul>
</template>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.actions__item {
  font-size: 14px;
}
</style>
