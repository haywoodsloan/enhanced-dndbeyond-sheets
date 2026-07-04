import { createApp } from 'vue';
import App from './App.vue';
import { parseSheetCharacterId } from '@/services/dndbeyond/sheet-url';

// The character id is passed as a query parameter when the sheet tab is opened.
const characterId = parseSheetCharacterId(window.location.href);

createApp(App, { characterId }).mount('#app');
