<script lang="ts" setup>
defineProps<{ characterId: number | null }>();
</script>

<template>
  <main class="sheet">
    <h1>Enhanced Character Sheet</h1>
    <p v-if="characterId != null">Character ID: {{ characterId }}</p>
    <p v-else>No character selected. Open this from a D&amp;D Beyond character page.</p>
  </main>
</template>
