import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import Tooltip from 'primevue/tooltip';
import App from './App.vue';
import { parseSheetCharacterId } from '@/utils/url/sheet-url';
import { debugLog } from '@/utils/debug';

// The character id is passed as a query parameter when the sheet tab is opened.
const characterId = parseSheetCharacterId(window.location.href);
debugLog('sheet', 'sheet page loaded', {
  href: window.location.href,
  characterId,
});

const primeUiLicense = import.meta.env.WXT_PRIMEUI_LICENSE?.trim();

createApp(App, { characterId })
  .use(PrimeVue, {
    license: primeUiLicense || undefined,
    // Always render the light theme: a print-friendly sheet should avoid the
    // ink-heavy dark surfaces the OS "dark mode" would otherwise trigger.
    theme: { preset: Aura, options: { darkModeSelector: false } },
  })
  // Themed hover tooltips for the icon-only card and settings controls.
  .directive('tooltip', Tooltip)
  .mount('#app');
