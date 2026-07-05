import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  // Build Manifest V3 for all browsers (including Firefox).
  manifestVersion: 3,
  manifest: {
    action: { default_title: 'Open enhanced character sheet' },
    // `contextMenus` (right-click entry), `activeTab` (read the current tab's URL
    // on click), `webRequest` (capture the user's Authorization header from D&D
    // Beyond's own request so private characters load), `storage` (hold that
    // header in storage.session).
    permissions: ['contextMenus', 'activeTab', 'webRequest', 'storage'],
    // Minimal hosts: `www.dndbeyond.com` is the page that INITIATES the requests
    // (Firefox's webRequest won't surface them without access to the initiator),
    // and `character-service` is where the token rides and where the sheet
    // fetches. https-only, no subdomain wildcard.
    host_permissions: [
      'https://www.dndbeyond.com/*',
      'https://character-service.dndbeyond.com/*',
    ],
    // Firefox MV3 requires an extension id; `data_collection_permissions`
    // declares that the extension collects no data (required by Firefox for new
    // extensions from 2025-11-03).
    browser_specific_settings: {
      gecko: {
        id: 'enhanced-dndbeyond-sheets@haywoodsloan',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
