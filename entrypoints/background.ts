import { extractAuthorization, setAuthToken } from '@/services/dndbeyond/auth-token';
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

  // Capture the user's `Authorization` header from D&D Beyond's own
  // character-service requests. Holding it lets the sheet load private
  // characters with the same credentials the page itself uses.
  browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const authorization = extractAuthorization(details.requestHeaders);
      if (authorization) {
        void setAuthToken(authorization);
      }
      return undefined;
    },
    { urls: ['https://character-service.dndbeyond.com/*'] },
    ['requestHeaders'],
  );

  browser.action.onClicked.addListener((tab) => {
    void openEnhancedSheet(tab.url);
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
      void openEnhancedSheet(info.pageUrl ?? tab?.url);
    }
  });
});

/**
 * Open the enhanced sheet for a D&D Beyond character page in a new tab. The
 * sheet fetches the character itself (using the captured `Authorization`
 * header), so it always reflects the character's latest state.
 */
async function openEnhancedSheet(pageUrl: string | undefined): Promise<void> {
  const characterId = parseCharacterId(pageUrl);
  if (characterId == null) return;

  const url = new URL(browser.runtime.getURL(`/${SHEET_PAGE}`));
  url.searchParams.set(CHARACTER_ID_PARAM, String(characterId));
  await browser.tabs.create({ url: url.toString() });
}
