const COBALT_TOKEN_URL = 'https://auth-service.dndbeyond.com/v1/cobalt-token';

interface CobaltTokenResponse {
  token?: string;
  /** Token lifetime in seconds. */
  ttl?: number;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Exchange the signed-in user's D&D Beyond session for a short-lived bearer
 * token, used to read characters that are not public.
 *
 * Relies on the browser attaching the `CobaltSession` cookie to the request,
 * which requires host permission for `auth-service.dndbeyond.com`. Returns null
 * when the user is not signed in (or the exchange fails).
 */
export async function getAuthToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) {
    return cachedToken.value;
  }

  let response: Response;
  try {
    response = await fetch(COBALT_TOKEN_URL, { method: 'POST', credentials: 'include' });
  } catch {
    return null;
  }

  if (!response.ok) {
    cachedToken = null;
    return null;
  }

  const body = (await response.json()) as CobaltTokenResponse;
  if (!body.token) return null;

  cachedToken = {
    value: body.token,
    expiresAt: Date.now() + (body.ttl ?? 60) * 1_000,
  };
  return body.token;
}

/** Clear the cached bearer token (e.g. after a failed authenticated request). */
export function clearAuthToken(): void {
  cachedToken = null;
}
