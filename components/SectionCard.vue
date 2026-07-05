<script lang="ts" setup>
import type { CharacterSection } from '@/services/dndbeyond/model';
import type { CardSize } from '@/utils/section-layout';

// `size` is passed in so a parent (and, later, the user) controls the card
// width. A future `expanded` prop will swap between a compact and a detailed
// body — the layout is structured to accommodate that.
defineProps<{
  section: CharacterSection;
  size: CardSize;
}>();
</script>

<template>
  <section
    class="card"
    :class="`card--${size}`"
    :data-section-key="section.key"
    draggable="true"
  >
    <header class="card__header">
      <h2 class="card__title">{{ section.title }}</h2>
      <span class="card__count">{{ section.count }}</span>
    </header>
    <div class="card__body">
      <p v-if="section.isEmpty" class="card__note">Nothing here yet.</p>
      <p v-else class="card__note">{{ section.count }} entries — details coming soon.</p>
    </div>
  </section>
</template>

<style scoped>
.card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 96px;
  padding: 10px 12px;
  border: 1px solid #cfcfcf;
  border-radius: 8px;
  background: #fff;
  cursor: grab;
}

.card--small {
  grid-column: span 1;
}

.card--medium {
  grid-column: span 2;
}

.card--large {
  grid-column: span 3;
}

.card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #ececec;
}

.card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.card__count {
  padding: 1px 8px;
  font-size: 12px;
  color: #555;
  background: #f1f1f1;
  border-radius: 999px;
}

.card__body {
  flex: 1;
}

.card__note {
  margin: 0;
  font-size: 13px;
  color: #888;
}
</style>
