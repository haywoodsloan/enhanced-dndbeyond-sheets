/** File name of the enhanced-sheet extension page. */
export const SHEET_PAGE = 'sheet.html';

/** Query parameter carrying the character id on the sheet page. */
export const CHARACTER_ID_PARAM = 'characterId';

/** Build the extension URL for the enhanced sheet of the given character. */
export function enhancedSheetUrl(characterId: number | string): string {
  const url = new URL(browser.runtime.getURL(`/${SHEET_PAGE}`));
  url.searchParams.set(CHARACTER_ID_PARAM, String(characterId));
  return url.toString();
}

/** Read the character id from an enhanced-sheet URL, or null. */
export function parseSheetCharacterId(url: string | null | undefined): number | null {
  if (!url) return null;

  let search: string;
  try {
    // The base allows parsing both absolute (chrome-extension://…) and relative URLs.
    search = new URL(url, 'https://sheet.invalid').search;
  } catch {
    return null;
  }

  const raw = new URLSearchParams(search).get(CHARACTER_ID_PARAM);
  if (raw == null) return null;

  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
