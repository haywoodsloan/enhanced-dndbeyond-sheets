import type { RawCharacter } from './api-types';

function cacheKey(id: number | string): string {
  return `character:${id}`;
}

/**
 * Store raw character data (fetched from the D&D Beyond page) so the enhanced
 * sheet can read it. Uses `storage.session`, which is in-memory and cleared when
 * the browser closes.
 */
export async function cacheRawCharacter(
  id: number | string,
  raw: RawCharacter,
): Promise<void> {
  await browser.storage.session.set({ [cacheKey(id)]: raw });
}

/** Read cached raw character data for an id, or null if none is stored. */
export async function readCachedCharacter(
  id: number | string,
): Promise<RawCharacter | null> {
  const key = cacheKey(id);
  const stored = await browser.storage.session.get(key);
  return (stored[key] as RawCharacter | undefined) ?? null;
}
