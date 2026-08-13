<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{ text: string }>();

interface Segment {
  text: string;
  bold: boolean;
}

// Split on `**bold**` markers into alternating plain / bold segments so a
// heading wrapped in ** renders in bold (the rest stays plain text).
const toSegments = (text: string): Segment[] =>
  text.split('**').map((part, index) => ({ text: part, bold: index % 2 === 1 }));

// D&D Beyond condenses list rules into a single blob with inline bullet
// markers; break them back onto their own lines so the benefits read as a list.
const blocks = computed(() => {
  const [lead, ...bullets] = props.text.split('•');
  return {
    lead: toSegments(lead.trimEnd()),
    bullets: bullets.map((bullet) => toSegments(bullet.trim())),
  };
});
</script>

<template>
  <span class="rich-text"
    ><template v-for="(segment, index) in blocks.lead" :key="index"
      ><strong v-if="segment.bold">{{ segment.text }}</strong
      ><template v-else>{{ segment.text }}</template></template
    ><span
      v-for="(bullet, index) in blocks.bullets"
      :key="`bullet-${index}`"
      class="rich-text__bullet"
      data-rich-text-bullet
      ><template v-for="(segment, sIndex) in bullet" :key="sIndex"
        ><strong v-if="segment.bold">{{ segment.text }}</strong
        ><template v-else>{{ segment.text }}</template></template
      ></span
    ></span
  >
</template>

<style scoped>
.rich-text {
  overflow-wrap: anywhere;
}

.rich-text__bullet {
  display: block;
  padding-left: 10px;
  text-indent: -7px;
}

.rich-text__bullet::before {
  content: '• ';
}
</style>
