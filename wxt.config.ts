import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    action: { default_title: 'Open enhanced character sheet' },
    // `contextMenus` for the right-click entry; `activeTab` + `scripting` let the
    // extension fetch the character from within the D&D Beyond tab on activation
    // (so private characters load); `storage` caches the result for the sheet.
    permissions: ['contextMenus', 'activeTab', 'scripting', 'storage'],
    // Used by the sheet's fallback direct fetch of public characters.
    host_permissions: ['https://character-service.dndbeyond.com/*'],
  },
});
