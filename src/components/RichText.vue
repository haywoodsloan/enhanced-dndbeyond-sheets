<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{ text: string }>();

// Split on `**bold**` markers into alternating plain / bold segments so a
// heading wrapped in ** renders in bold (the rest stays plain text).
const segments = computed(() =>
  props.text.split('**').map((text, index) => ({ text, bold: index % 2 === 1 })),
);
</script>

<template>
  <span class="rich-text"
    ><template v-for="(segment, index) in segments" :key="index"
      ><strong v-if="segment.bold">{{ segment.text }}</strong
      ><template v-else>{{ segment.text }}</template></template
    ></span
  >
</template>

<style scoped>
.rich-text {
  overflow-wrap: anywhere;
}
</style>
