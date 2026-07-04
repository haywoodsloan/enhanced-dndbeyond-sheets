import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    // Allows the background script to fetch public character data without CORS
    // restrictions.
    host_permissions: ['https://character-service.dndbeyond.com/*'],
  },
});
