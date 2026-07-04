const AUTH_TOKEN_KEY = 'ddb-authorization';

/**
 * The user's D&D Beyond `Authorization` header value, captured from the page's
 * own character-service request (see the background's webRequest listener).
 *
 * Held in `storage.session`: in-memory, cleared when the browser closes, and
 * never written to disk. Private characters require this header.
 */

/** Extract the `Authorization` header value from a request's headers, or null. */
export function extractAuthorization(
  headers: { name: string; value?: string }[] | undefined,
): string | null {
  const header = headers?.find((entry) => entry.name.toLowerCase() === 'authorization');
  return header?.value ?? null;
}

/** Store the captured `Authorization` header value. */
export async function setAuthToken(authorization: string): Promise<void> {
  await browser.storage.session.set({ [AUTH_TOKEN_KEY]: authorization });
}

/** Read the captured `Authorization` header value, or null if none captured. */
export async function getAuthToken(): Promise<string | null> {
  const stored = await browser.storage.session.get(AUTH_TOKEN_KEY);
  return (stored[AUTH_TOKEN_KEY] as string | undefined) ?? null;
}
