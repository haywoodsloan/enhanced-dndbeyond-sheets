<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{ text: string }>();
const parts = computed(() => props.text.split('↑'));
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <span v-if="index > 0" class="inline-scaling-text__arrow">↑</span>{{ part }}
  </template>
</template>

<style scoped>
.inline-scaling-text__arrow {
  display: inline-block;
  width: 0.86em;
  height: 0.95em;
  margin-inline: 0.08em;
  overflow: hidden;
  color: inherit;
  text-indent: -9999px;
  vertical-align: -0.16em;
  background: currentColor;
  clip-path: polygon(50% 0, 100% 44%, 72% 44%, 72% 100%, 28% 100%, 28% 44%, 0 44%);
}
</style>