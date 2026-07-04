export interface InPageFetchResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}

/**
 * Fetch a URL from INSIDE the D&D Beyond page via `scripting.executeScript`.
 *
 * Because it runs in the page's context, the request is same-site and carries
 * the user's logged-in session cookie — this is what allows private characters
 * to load. It must stay self-contained (no imports or closure references) so it
 * can be serialized and injected.
 */
export async function fetchCharacterInPage(url: string): Promise<InPageFetchResult> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: await response.json() };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
