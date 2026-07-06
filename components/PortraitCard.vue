<script lang="ts" setup>
defineProps<{ avatarUrl: string }>();
</script>

<template>
  <div class="portrait">
    <img class="portrait__img" :src="avatarUrl" alt="Character portrait" />
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
</style>
