import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    action: { default_title: 'Open enhanced character sheet' },
    // `contextMenus` for the right-click entry; `activeTab` grants access to the
    // current tab's URL when the user invokes the extension.
    permissions: ['contextMenus', 'activeTab'],
    // Allow fetching character data and exchanging the user's session for a
    // bearer token (needed to read private characters) without CORS restrictions.
    host_permissions: [
      'https://character-service.dndbeyond.com/*',
      'https://auth-service.dndbeyond.com/*',
    ],
  },
});
