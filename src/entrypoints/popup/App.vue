<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { parseCharacterId } from '@/utils/url/character-url';
import { enhancedSheetUrl } from '@/utils/url/sheet-url';
import { debugLog } from '@/utils/debug';

// Hidden until we know the active tab isn't a character page, so a character
// page opens the sheet without flashing the prompt.
const showPrompt = ref(false);

onMounted(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const characterId = parseCharacterId(tab?.url);
  debugLog('popup', 'active tab', { url: tab?.url, characterId });

  if (characterId != null) {
    await browser.tabs.create({ url: enhancedSheetUrl(characterId) });
    window.close();
    return;
  }

  showPrompt.value = true;
});
</script>

<template>
  <main class="popup">
    <p v-if="showPrompt">
      Open a D&amp;D Beyond character page, then select Beyond+ again.
    </p>
  </main>
</template>

<style>
:root {
  color-scheme: light dark;
}

body {
  margin: 0;
}

.popup {
  box-sizing: border-box;
  min-width: 240px;
  max-width: 300px;
  padding: 14px 16px;
  font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.popup p {
  margin: 0;
}
</style>
