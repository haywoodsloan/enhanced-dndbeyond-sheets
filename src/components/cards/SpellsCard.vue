<script lang="ts" setup>
import { computed } from 'vue';
import type { SpellEntry } from '@/services/dndbeyond/model';

const props = defineProps<{ spells: SpellEntry[] }>();

const groups = computed(() => {
  const byLevel = new Map<number, string[]>();
  for (const spell of props.spells) {
    const names = byLevel.get(spell.level) ?? [];
    names.push(spell.name);
    byLevel.set(spell.level, names);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, names]) => ({
      level,
      label: level === 0 ? 'Cantrips' : `Level ${level}`,
      names,
    }));
});
</script>

<template>
  <div class="spells">
    <div
      v-for="group in groups"
      :key="group.level"
      class="spells__group"
      :data-level="group.level"
    >
      <span class="spells__label">{{ group.label }}</span>
      <span class="spells__names">{{ group.names.join(', ') }}</span>
    </div>
  </div>
</template>

<style scoped>
.spells {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spells__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spells__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.spells__names {
  font-size: 14px;
}
</style>
