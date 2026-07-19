<script lang="ts" setup>
import type { DefenceEntry, SavingThrow } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/character/dnd5e';

withDefaults(defineProps<{ saves: SavingThrow[]; defences?: DefenceEntry[] }>(), {
  defences: () => [],
});
</script>

<template>
  <div class="saves-card">
    <ul class="saves">
      <li v-for="save in saves" :key="save.key" class="save" :data-save="save.key">
        <span
          class="save__prof"
          :class="{ 'save__prof--on': save.proficient }"
          :title="save.proficient ? 'Proficient' : 'Not proficient'"
        ></span>
        <span class="save__name" :title="save.name">{{ save.key.toUpperCase() }}</span>
        <span class="save__mod">{{ formatModifier(save.modifier) }}</span>
      </li>
    </ul>

    <div v-if="defences.length" class="defences" data-defences>
      <ul class="defences__list">
        <li v-for="(entry, index) in defences" :key="index" class="defences__item">
          <span v-if="entry.qualifier" class="defences__qualifier">({{ entry.qualifier }})</span
          >{{ entry.text }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.saves-card {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: 1fr;
  gap: 16px;
  align-items: stretch;
  height: 100%;
}

.saves {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Equal-height bands distribute the saves down the full card height, matching
   the Skills card (its twin prof-dot + name + modifier list). */
.save {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

/* Subtle horizontal rule between save rows (they carry no bullet marker). */
.save + .save {
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
}

.save__prof {
  flex: none;
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--p-text-muted-color, #888);
  border-radius: 50%;
}

.save__prof--on {
  background: var(--p-primary-color, #1c1c1e);
  border-color: var(--p-primary-color, #1c1c1e);
}

.save__name {
  flex: 1;
}

.save__mod {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.defences {
  display: flex;
  flex-direction: column;
  /* Spread the entries down the column so the list reaches the card bottom in
     step with the saves, keeping the two sides balanced. */
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  border-left: 1px solid var(--p-primary-300, #d4d4d8);
  padding-left: 16px;
}

.defences__list {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

.defences__item {
  font-size: 13px;
  line-height: 1.3;
}

/* The advantage/disadvantage type shown as a muted "(…)" qualifier before the
   restriction, which is the part worth reading. */
.defences__qualifier {
  margin-right: 4px;
  color: var(--p-text-muted-color, #888);
}

.defences__item + .defences__item {
  margin-top: 6px;
}
</style>
