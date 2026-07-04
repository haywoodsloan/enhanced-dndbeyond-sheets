import type { DdbApiResponse } from '@/services/dndbeyond/api-types';
import { cacheRawCharacter } from '@/services/dndbeyond/character-cache';
import { parseCharacterId } from '@/services/dndbeyond/character-url';
import { characterServiceUrl } from '@/services/dndbeyond/fetch-character';
import { fetchCharacterInPage } from '@/services/dndbeyond/fetch-in-page';
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

  browser.action.onClicked.addListener((tab) => {
    void activate(tab);
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID && tab) {
      void activate(tab, info.pageUrl);
    }
  });
});

/** Handle activation from the toolbar icon or context menu on a character page. */
async function activate(
  tab: { id?: number; url?: string },
  pageUrl?: string,
): Promise<void> {
  const characterId = parseCharacterId(pageUrl ?? tab.url);
  if (characterId == null) return;

  // Fetch the character from within the D&D Beyond page so the request uses the
  // user's logged-in session (this is what makes private characters load), then
  // cache it for the sheet. If it fails, the sheet falls back to a direct fetch
  // that only works for public characters.
  if (tab.id != null) {
    await cacheCharacterFromPage(tab.id, characterId);
  }

  const url = new URL(browser.runtime.getURL(`/${SHEET_PAGE}`));
  url.searchParams.set(CHARACTER_ID_PARAM, String(characterId));
  await browser.tabs.create({ url: url.toString() });
}

/** Inject a fetch into the D&D Beyond tab and cache the result for the sheet. */
async function cacheCharacterFromPage(
  tabId: number,
  characterId: number,
): Promise<void> {
  try {
    const injections = await browser.scripting.executeScript({
      target: { tabId },
      func: fetchCharacterInPage,
      args: [characterServiceUrl(characterId)],
    });

    const result = injections[0]?.result;
    if (!result?.ok) return;

    const body = result.body as DdbApiResponse | undefined;
    if (body?.success && body.data != null) {
      await cacheRawCharacter(characterId, body.data);
    }
  } catch {
    // Injection can fail (e.g., the tab isn't a D&D Beyond page); the sheet falls back.
  }
}
