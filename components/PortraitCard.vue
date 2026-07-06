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
  display: flex;
  justify-content: center;
}

.portrait__img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
}
</style>
