import { extractAuthorization, setAuthToken } from '@/services/dndbeyond/auth-token';
import { parseCharacterId } from '@/utils/character-url';
import { CHARACTER_ID_PARAM, SHEET_PAGE } from '@/utils/sheet-url';
import { debugLog } from '@/utils/debug';

const CONTEXT_MENU_ID = 'open-enhanced-sheet';

/** Last captured `Authorization` value, used to skip redundant storage writes. */
let lastCapturedAuthorization: string | null = null;

export default defineBackground(() => {
  debugLog('bg', 'background script loaded');

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Open enhanced character sheet',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.dndbeyond.com/characters/*'],
    });
  });

  // DIAGNOSTIC: log every character-service request so we can watch the live
  // traffic, and capture the `Authorization` header off it (deduping repeats).
  browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const authorization = extractAuthorization(details.requestHeaders);
      debugLog('bg', 'character-service request', {
        method: details.method,
        url: details.url,
        hasAuthorization: authorization != null,
        scheme: authorization ? authorization.split(' ')[0] : null,
        length: authorization?.length ?? 0,
      });
      if (authorization && authorization !== lastCapturedAuthorization) {
        lastCapturedAuthorization = authorization;
        debugLog('bg', 'captured authorization from character-service');
        void setAuthToken(authorization);
      }
      return undefined;
    },
    { urls: ['https://character-service.dndbeyond.com/*'] },
    ['requestHeaders'],
  );
  debugLog('bg', 'webRequest listener registered');

  browser.action.onClicked.addListener((tab) => {
    debugLog('bg', 'action icon clicked', { url: tab.url });
    void openEnhancedSheet(tab.url);
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
      debugLog('bg', 'context menu clicked', {
        pageUrl: info.pageUrl,
        tabUrl: tab?.url,
      });
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
  debugLog('bg', 'openEnhancedSheet', { pageUrl, characterId });
  if (characterId == null) {
    await notifyOpenCharacter();
    return;
  }

  const url = new URL(browser.runtime.getURL(`/${SHEET_PAGE}`));
  url.searchParams.set(CHARACTER_ID_PARAM, String(characterId));
  await browser.tabs.create({ url: url.toString() });
}

/** Prompt the user to open a D&D Beyond character page when none is active. */
async function notifyOpenCharacter(): Promise<void> {
  debugLog('bg', 'not a character page — prompting user');
  await browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: 'Enhanced D&D Beyond Sheets',
    message: 'Please open a D&D Beyond character and try again.',
  });
}
