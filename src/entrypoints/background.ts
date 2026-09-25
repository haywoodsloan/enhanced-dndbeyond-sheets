import {
  AUTH_TOKEN_KEY,
  extractAuthorization,
  setAuthToken,
} from '@/services/dndbeyond/auth-token';
import { parseCharacterId } from '@/utils/url/character-url';
import { enhancedSheetUrl } from '@/utils/url/sheet-url';
import { debugLog } from '@/utils/debug';

const CONTEXT_MENU_ID = 'open-enhanced-sheet';

export default defineBackground(() => {
  let lastCapturedAuthorization: string | null = null;
  const pendingAuthorizations = new Set<string>();
  debugLog('bg', 'background script loaded');

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Open enhanced character sheet',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.dndbeyond.com/characters/*'],
    });
  });

  // Capture the Authorization header from D&D Beyond's own character request,
  // deduping repeats. Diagnostics never include token-derived metadata.
  browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const authorization = extractAuthorization(details.requestHeaders);
      debugLog('bg', 'character-service request', {
        method: details.method,
        url: details.url,
        hasAuthorization: authorization != null,
      });
      if (
        authorization &&
        authorization !== lastCapturedAuthorization &&
        !pendingAuthorizations.has(authorization)
      ) {
        pendingAuthorizations.add(authorization);
        debugLog('bg', 'captured authorization from character-service');
        void setAuthToken(authorization)
          .catch(() => {
            // Storage errors may include their input; never log that payload.
            debugLog('bg', 'authorization capture failed');
          })
          .finally(() => pendingAuthorizations.delete(authorization));
      }
      return undefined;
    },
    { urls: ['https://character-service.dndbeyond.com/*'] },
    ['requestHeaders'],
  );
  debugLog('bg', 'webRequest listener registered');

  // Only committed storage changes update deduplication. Failed captures remain
  // retryable, and clearing a credential permits the same header to be captured.
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'session' || !(AUTH_TOKEN_KEY in changes)) return;
    const next = changes[AUTH_TOKEN_KEY].newValue;
    lastCapturedAuthorization = typeof next === 'string' ? next : null;
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
  if (characterId == null) return;
  await browser.tabs.create({ url: enhancedSheetUrl(characterId) });
}
