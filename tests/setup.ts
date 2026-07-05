import { config } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';

// PrimeVue components need the plugin installed on the app, so register it
// globally for every component mounted in tests.
config.global.plugins.push([PrimeVue, { theme: { preset: Aura } }]);
