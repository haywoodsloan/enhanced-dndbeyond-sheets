<script lang="ts" setup>
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import AbilityScores from '@/components/AbilityScores.vue';
import BasicsCard from '@/components/BasicsCard.vue';
import type { Character, CharacterSection } from '@/services/dndbeyond/model';
import type { CardSize } from '@/utils/section-layout';

// `size` controls the card width (grid span). A future `expanded` prop will
// swap between a compact and a detailed body — the layout is structured for it.
defineProps<{
  section: CharacterSection;
  size: CardSize;
  character?: Character | null;
}>();
</script>

<template>
  <Card
    class="card"
    :class="`card--${size}`"
    :data-section-key="section.key"
    draggable="true"
  >
    <template #title>
      <div class="card__title">
        <span>{{ section.title }}</span>
        <Tag
          v-if="section.count > 0"
          :value="String(section.count)"
          severity="secondary"
          rounded
        />
      </div>
    </template>
    <template #content>
      <AbilityScores
        v-if="section.key === 'attributes' && character"
        :abilities="character.abilities"
      />
      <BasicsCard
        v-else-if="section.key === 'basics' && character"
        :basics="character.basics"
      />
      <p v-else-if="section.isEmpty" class="card__note">Nothing here yet.</p>
      <p v-else class="card__note">Details coming soon.</p>
    </template>
  </Card>
</template>

<style scoped>
.card {
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

.card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
}

.card__note {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
