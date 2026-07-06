<script lang="ts" setup>
import { computed } from 'vue';
import type { CharacterProficiencies } from '@/services/dndbeyond/model';

const props = defineProps<{ proficiencies: CharacterProficiencies }>();

const groups = computed(() =>
  [
    { label: 'Languages', items: props.proficiencies.languages },
    { label: 'Weapons', items: props.proficiencies.weapons },
    { label: 'Armor', items: props.proficiencies.armor },
    { label: 'Tools', items: props.proficiencies.tools },
  ].filter((group) => group.items.length > 0),
);
</script>

<template>
  <div class="profs">
    <div
      v-for="group in groups"
      :key="group.label"
      class="profs__group"
      :data-group="group.label"
    >
      <span class="profs__label">{{ group.label }}</span>
      <span class="profs__items">{{ group.items.join(', ') }}</span>
    </div>
    <p v-if="groups.length === 0" class="profs__empty">None</p>
  </div>
</template>

<style scoped>
.profs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profs__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profs__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.profs__items {
  font-size: 14px;
}

.profs__empty {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
