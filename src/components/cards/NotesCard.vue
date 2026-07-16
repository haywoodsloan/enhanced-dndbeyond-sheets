<template>
  <!-- A blank, ruled area for handwriting notes on the printed sheet. -->
  <div class="notes" aria-label="Notes"></div>
</template>

<style scoped>
.notes {
  height: 100%;
  min-height: 120px;
  /* Faint ruled lines to write on. */
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 27px,
    var(--p-primary-200, #e4e4e7) 27px,
    var(--p-primary-200, #e4e4e7) 28px
  );
}
</style>
