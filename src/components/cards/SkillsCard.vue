<script lang="ts" setup>
import { computed } from 'vue';
import type { Skill } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';

const props = defineProps<{ skills: Skill[]; columns?: number }>();

// Split into N balanced columns (from the chosen layout) so each column can
// stretch down the full card height instead of leaving space at the bottom.
const columnGroups = computed(() => {
  const count = Math.max(1, props.columns ?? 3);
  const size = Math.ceil(props.skills.length / count);
  return Array.from({ length: count }, (_, index) =>
    props.skills.slice(index * size, (index + 1) * size),
  ).filter((column) => column.length > 0);
});
</script>

<template>
  <div class="skills">
    <ul v-for="(group, colIndex) in columnGroups" :key="colIndex" class="skills__column">
      <li
        v-for="skill in group"
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
  </div>
</template>

<style scoped>
.skills {
  display: flex;
  align-items: stretch;
  height: 100%;
}

.skills__column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0 16px;
  list-style: none;
}

.skills__column:first-child {
  padding-left: 0;
}

.skills__column:last-child {
  padding-right: 0;
}

/* A vertical rule between columns, like the saves / defences divider. */
.skills__column + .skills__column {
  border-left: 1px solid var(--p-primary-300, #d4d4d8);
}

.skill {
  /* Equal-height bands distribute the skills down the full card height. */
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

/* Subtle horizontal rule between skill rows (they carry no bullet marker). */
.skill + .skill {
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
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
  background: var(--p-primary-color, #1c1c1e);
  border-color: var(--p-primary-color, #1c1c1e);
}

.skill__prof--expertise {
  box-shadow:
    0 0 0 2px var(--paper, #fff),
    0 0 0 3.5px var(--p-primary-color, #1c1c1e);
}

.skill__prof--half {
  background: linear-gradient(
    90deg,
    var(--p-primary-color, #1c1c1e) 50%,
    transparent 50%
  );
}

.skill__name {
  flex: 1;
}

.skill__ability {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}

.skill__mod {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
