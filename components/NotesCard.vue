<script lang="ts" setup>
import type { NoteEntry } from '@/services/dndbeyond/model';

withDefaults(defineProps<{ notes?: NoteEntry[] }>(), {
  notes: () => [],
});
</script>

<template>
  <div class="notes">
    <div
      v-for="note in notes"
      :key="note.label"
      class="notes__entry"
      :data-note="note.label"
    >
      <span class="notes__label">{{ note.label }}</span>
      <p class="notes__text">{{ note.text }}</p>
    </div>
  </div>
</template>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notes__entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notes__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.notes__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
}
</style>
