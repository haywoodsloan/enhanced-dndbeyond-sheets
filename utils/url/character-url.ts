/**
 * Parsing helpers for D&D Beyond character page URLs, e.g.
 * `https://www.dndbeyond.com/characters/166869100`.
 */

/** Matches a D&D Beyond character page URL and captures the numeric id. */
const CHARACTER_URL_PATTERN =
  /^https?:\/\/(?:www\.)?dndbeyond\.com\/characters\/(\d+)(?:[/?#]|$)/i;

/** Return the character id from a D&D Beyond character URL, or null. */
export function parseCharacterId(url: string | null | undefined): number | null {
  if (!url) return null;
  const match = CHARACTER_URL_PATTERN.exec(url);
  return match ? Number(match[1]) : null;
}

/** True when the URL is a D&D Beyond character page. */
export function isCharacterUrl(url: string | null | undefined): boolean {
  return parseCharacterId(url) !== null;
}
