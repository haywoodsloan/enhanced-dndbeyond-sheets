import { parseCharacterId } from '@/services/dndbeyond/character-url';
import { CHARACTER_ID_PARAM, SHEET_PAGE } from '@/services/dndbeyond/sheet-url';

const CONTEXT_MENU_ID = 'open-enhanced-sheet';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Open enhanced character sheet',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.dndbeyond.com/characters/*'],
    });
  });

  // Clicking the toolbar icon activates the extension for the current tab.
  browser.action.onClicked.addListener((tab) => {
    void openEnhancedSheet(tab.url);
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
      void openEnhancedSheet(info.pageUrl ?? tab?.url);
    }
  });
});

/** Open the enhanced sheet in a new tab if the page is a D&D Beyond character page. */
async function openEnhancedSheet(pageUrl: string | undefined): Promise<void> {
  const characterId = parseCharacterId(pageUrl);
  if (characterId == null) return;

  const url = new URL(browser.runtime.getURL(`/${SHEET_PAGE}`));
  url.searchParams.set(CHARACTER_ID_PARAM, String(characterId));
  await browser.tabs.create({ url: url.toString() });
}
