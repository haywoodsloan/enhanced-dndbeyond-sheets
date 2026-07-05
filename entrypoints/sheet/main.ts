import { createApp } from 'vue';
import App from './App.vue';
import { parseSheetCharacterId } from '@/utils/sheet-url';
import { debugLog } from '@/utils/debug';

// The character id is passed as a query parameter when the sheet tab is opened.
const characterId = parseSheetCharacterId(window.location.href);
debugLog('sheet', 'sheet page loaded', {
  href: window.location.href,
  characterId,
});

createApp(App, { characterId }).mount('#app');
