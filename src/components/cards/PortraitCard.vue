<script lang="ts" setup>
import { ref, watch } from 'vue';

const props = defineProps<{ avatarUrl: string }>();

// Fall back to the placeholder if the avatar image fails to load (a dead or
// 404 URL), so the printed sheet shows a clean frame instead of a broken image.
const failed = ref(false);
watch(
  () => props.avatarUrl,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <div class="portrait">
    <img
      v-if="avatarUrl && !failed"
      class="portrait__img"
      :src="avatarUrl"
      alt="Character portrait"
      @error="failed = true"
    />
    <!-- No (usable) avatar: a faint silhouette marks the frame as a place to draw
         or paste a portrait on the printed sheet. -->
    <div v-else class="portrait__placeholder" data-portrait-empty aria-hidden="true">
      <svg class="portrait__icon" viewBox="0 0 24 24">
        <circle cx="12" cy="8.5" r="4" />
        <path d="M4.5 20c0-4.2 3.4-6.5 7.5-6.5s7.5 2.3 7.5 6.5" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.portrait {
  height: 100%;
}

.portrait__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.portrait__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 6px;
}

.portrait__icon {
  width: 45%;
  max-width: 88px;
  height: auto;
  color: var(--p-primary-300, #d4d4d8);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
