import { config } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import Tooltip from 'primevue/tooltip';

// PrimeVue components need the plugin installed on the app, so register it
// globally for every component mounted in tests.
config.global.plugins.push([
	PrimeVue,
	{
		license: import.meta.env.WXT_PRIMEUI_LICENSE?.trim() || undefined,
		theme: { preset: Aura },
	},
]);
// The v-tooltip directive is used by SectionCard/App, so register it too.
config.global.directives = { ...config.global.directives, tooltip: Tooltip };
