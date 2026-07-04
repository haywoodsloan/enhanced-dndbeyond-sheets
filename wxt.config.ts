import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  // Build Manifest V3 for all browsers (including Firefox).
  manifestVersion: 3,
  manifest: {
    action: { default_title: 'Open enhanced character sheet' },
    // `contextMenus` for the right-click entry; `activeTab` + `scripting` let the
    // extension fetch the character from within the D&D Beyond tab on activation
    // (so private characters load); `storage` caches the result for the sheet.
    permissions: ['contextMenus', 'activeTab', 'scripting', 'storage'],
    // Used by the sheet's fallback direct fetch of public characters.
    host_permissions: ['https://character-service.dndbeyond.com/*'],
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
