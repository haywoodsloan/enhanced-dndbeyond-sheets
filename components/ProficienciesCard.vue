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
    <p
      v-for="group in groups"
      :key="group.label"
      class="profs__group"
      :data-group="group.label"
    >
      <span class="profs__label">{{ group.label }}:</span>
      <span class="profs__items">{{ group.items.join(', ') }}</span>
    </p>
    <p v-if="groups.length === 0" class="profs__empty">None</p>
  </div>
</template>

<style scoped>
.profs {
  display: flex;
  flex-direction: column;
  /* Spread the groups down the full card height so the wider (2-col) layout
     doesn't leave empty space at the bottom; `gap` is the minimum spacing. */
  justify-content: space-between;
  gap: 6px;
  height: 100%;
}

.profs__group {
  margin: 0;
  font-size: 13px;
  line-height: 1.3;
}

.profs__label {
  margin-right: 5px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.profs__items {
  color: #1c1c1e;
}

.profs__empty {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
