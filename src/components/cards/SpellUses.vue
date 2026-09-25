<script lang="ts" setup>
import type { SpellEntry } from '@/services/dndbeyond/model';
import ResourceBoxes from '@/components/cards/ResourceBoxes.vue';

defineProps<{ spell: SpellEntry; cardParts?: boolean }>();
</script>

<template>
  <template v-if="spell.featureUses?.length">
    <span
      v-for="(grant, index) in spell.featureUses"
      :key="`${grant.source}-${index}`"
      class="spell-uses"
      data-spell-uses
      :data-spell-card-part="cardParts ? '' : undefined"
    >
      <span class="spell-uses__source">{{ grant.source }}</span>
      <ResourceBoxes :resource="grant.pool" />
    </span>
  </template>
  <ResourceBoxes
    v-else-if="spell.uses"
    :resource="spell.uses"
    data-spell-uses
    :data-spell-card-part="cardParts ? '' : undefined"
  />
</template>

<style scoped>
.spell-uses {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin-left: 6px;
  font-size: 12px;
}

.spell-uses__source {
  color: var(--p-text-muted-color, #888);
}
</style>
