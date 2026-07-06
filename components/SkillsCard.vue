<script lang="ts" setup>
import type { Skill } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/dnd5e';

defineProps<{ skills: Skill[] }>();
</script>

<template>
  <ul class="skills">
    <li
      v-for="skill in skills"
      :key="skill.key"
      class="skill"
      :data-skill="skill.key"
    >
      <span
        class="skill__prof"
        :class="`skill__prof--${skill.proficiency}`"
        :title="skill.proficiency"
      ></span>
      <span class="skill__name">{{ skill.name }}</span>
      <span class="skill__ability">{{ skill.ability.toUpperCase() }}</span>
      <span class="skill__mod">{{ formatModifier(skill.modifier) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.skills {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.skill {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.skill__prof {
  flex: none;
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--p-text-muted-color, #888);
  border-radius: 50%;
}

.skill__prof--proficient,
.skill__prof--expertise {
  background: var(--p-text-color, #1c1c1e);
  border-color: var(--p-text-color, #1c1c1e);
}

.skill__prof--expertise {
  box-shadow:
    0 0 0 2px var(--paper, #fff),
    0 0 0 3.5px var(--p-text-color, #1c1c1e);
}

.skill__prof--half {
  background: linear-gradient(
    90deg,
    var(--p-text-color, #1c1c1e) 50%,
    transparent 50%
  );
}

.skill__name {
  flex: 1;
}

.skill__ability {
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
}

.skill__mod {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
