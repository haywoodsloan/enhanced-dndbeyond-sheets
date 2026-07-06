<script lang="ts" setup>
import type { AbilityScore } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/dnd5e';

defineProps<{ abilities: AbilityScore[] }>();
</script>

<template>
  <ul class="abilities">
    <li
      v-for="ability in abilities"
      :key="ability.key"
      class="ability"
      :data-ability="ability.key"
    >
      <span class="ability__name">{{ ability.name }}</span>
      <span class="ability__mod">{{ formatModifier(ability.modifier) }}</span>
      <span class="ability__score">{{ ability.score }}</span>
    </li>
  </ul>
</template>

<style scoped>
.abilities {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
}

.ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 4px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 8px;
}

.ability__name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--p-text-muted-color, #888);
}

.ability__mod {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.ability__score {
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
