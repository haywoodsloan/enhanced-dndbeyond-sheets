<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { Character } from '@/services/dndbeyond/model';
import { loadCharacter } from '@/services/dndbeyond/load-character';
import { defaultSectionOrder } from '@/utils/section-order';
import { debugLog } from '@/utils/debug';

const props = defineProps<{ characterId: number | null }>();

type Status = 'idle' | 'loading' | 'loaded' | 'error';

const status = ref<Status>('idle');
const character = ref<Character | null>(null);
const errorMessage = ref('');

const subtitle = computed(() => {
  const loaded = character.value;
  if (!loaded) return '';
  const classes = loaded.classes
    .map((cls) =>
      cls.subclass ? `${cls.name} ${cls.level} (${cls.subclass})` : `${cls.name} ${cls.level}`,
    )
    .join(' / ');
  return [loaded.race, classes].filter(Boolean).join(' · ');
});

const orderedSections = computed(() =>
  character.value ? defaultSectionOrder(character.value) : [],
);

onMounted(async () => {
  if (props.characterId == null) {
    debugLog('sheet', 'App mounted without a character id');
    return;
  }
  status.value = 'loading';
  try {
    character.value = await loadCharacter(props.characterId);
    status.value = 'loaded';
    debugLog('sheet', 'App loaded character', { id: props.characterId });
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load character.';
    status.value = 'error';
    debugLog('sheet', 'App failed to load character', {
      id: props.characterId,
      error: errorMessage.value,
    });
  }
});
</script>

<template>
  <main class="sheet">
    <p v-if="characterId == null">
      No character selected. Open this from a D&amp;D Beyond character page.
    </p>

    <p v-else-if="status === 'idle' || status === 'loading'">Loading character…</p>

    <p v-else-if="status === 'error'" role="alert">
      Could not load character: {{ errorMessage }}
    </p>

    <template v-else-if="character">
      <header>
        <h1>{{ character.name }}</h1>
        <p>{{ subtitle }}</p>
      </header>

      <ul>
        <li
          v-for="section in orderedSections"
          :key="section.key"
          :data-section-key="section.key"
        >
          {{ section.title }}: {{ section.count }}
        </li>
      </ul>
    </template>
  </main>
</template>
